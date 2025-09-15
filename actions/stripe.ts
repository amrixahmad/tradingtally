"use server"

import {
  createCustomer,
  getCustomerByUserId,
  updateCustomerByStripeCustomerId,
  updateCustomerByUserId
} from "@/actions/customers"
import { SelectCustomer } from "@/db/schema/customers"
import { stripe } from "@/lib/stripe"
import { auth } from "@clerk/nextjs/server"
import Stripe from "stripe"
import { redirect } from "next/navigation"

type MembershipStatus = SelectCustomer["membership"]

const getMembershipStatus = (
  status: Stripe.Subscription.Status,
  membership: MembershipStatus
): MembershipStatus => {
  switch (status) {
    case "active":
    case "trialing":
      return membership
    case "canceled":
    case "incomplete":
    case "incomplete_expired":
    case "past_due":
    case "paused":
    case "unpaid":
      return "free"
    default:
      return "free"
  }
}

// Return a concise summary of the current user's subscription, if any
export type SubscriptionSummary = {
  status: Stripe.Subscription.Status
  cancelAtPeriodEnd: boolean
  currentPeriodEnd: number | null // epoch seconds
  paymentMethod: {
    brand: string | null
    last4: string | null
    expMonth: number | null
    expYear: number | null
  } | null
}

export const getUserSubscriptionSummary = async (
  userId: string
): Promise<SubscriptionSummary | null> => {
  try {
    if (!userId) return null

    const customer = await getCustomerByUserId(userId)
    if (!customer?.stripeCustomerId) return null

    // Preferred path: use stored subscription id if available
    let subscriptionResponse: Stripe.Response<Stripe.Subscription> | null = null
    if (customer.stripeSubscriptionId) {
      try {
        subscriptionResponse = await stripe.subscriptions.retrieve(
          customer.stripeSubscriptionId,
          { expand: ["default_payment_method"] }
        )
      } catch (err) {
        // Fall through to listing by customer if the stored ID is stale
        subscriptionResponse = null
      }
    }

    // Fallback: find most recent active (or trialing) subscription for the customer
    if (!subscriptionResponse) {
      const list = await stripe.subscriptions.list({
        customer: customer.stripeCustomerId,
        status: "all",
        limit: 3,
        expand: ["data.default_payment_method"]
      })

      // Pick the most relevant subscription: active > trialing > past_due > unpaid > canceled
      const preferredOrder: Record<string, number> = {
        active: 0,
        trialing: 1,
        past_due: 2,
        unpaid: 3,
        paused: 4,
        incomplete: 5,
        incomplete_expired: 6,
        canceled: 7
      }
      const best = [...list.data].sort(
        (a, b) => (preferredOrder[a.status] ?? 99) - (preferredOrder[b.status] ?? 99)
      )[0]

      if (!best) return null
      subscriptionResponse = best as unknown as Stripe.Response<Stripe.Subscription>

      // If DB has no subscription id or it's different, persist the latest one
      if (!customer.stripeSubscriptionId || customer.stripeSubscriptionId !== best.id) {
        try {
          await updateCustomerByUserId(userId, {
            stripeSubscriptionId: best.id
          })
        } catch (e) {
          // Non-fatal; keep rendering
        }
      }
    }

    type SubscriptionLite = {
      status: Stripe.Subscription.Status
      cancel_at_period_end?: boolean
      current_period_end?: number
      default_payment_method?: Stripe.PaymentMethod | string | null
    }

    const subscription = subscriptionResponse as unknown as SubscriptionLite

    let pm: SubscriptionSummary["paymentMethod"] = null
    const dpm = subscription.default_payment_method as
      | Stripe.PaymentMethod
      | string
      | null
    if (dpm && typeof dpm !== "string" && dpm.card) {
      pm = {
        brand: dpm.card.brand || null,
        last4: dpm.card.last4 || null,
        expMonth: dpm.card.exp_month || null,
        expYear: dpm.card.exp_year || null
      }
    }

    return {
      status: subscription.status,
      cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
      currentPeriodEnd: subscription.current_period_end ?? null,
      paymentMethod: pm
    }
  } catch (error) {
    console.error("Error fetching subscription summary:", error)
    return null
  }
}

// Create a Stripe Billing Portal session and redirect the user there
export const openBillingPortal = async () => {
  try {
    const { userId } = await auth()

    if (!userId) {
      throw new Error("User must be authenticated to manage billing")
    }

    // Look up Stripe customer
    const existingCustomer = await getCustomerByUserId(userId)

    if (!existingCustomer?.stripeCustomerId) {
      throw new Error(
        "No Stripe customer found for this user. Complete a checkout first."
      )
    }

    // Where to send users back after managing billing
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    const returnUrl = `${baseUrl}/dashboard/billing`

    const session = await stripe.billingPortal.sessions.create({
      customer: existingCustomer.stripeCustomerId,
      return_url: returnUrl
    })

    // Redirect the user to the Billing Portal
    redirect(session.url)
  } catch (error) {
    console.error("Error opening billing portal:", error)
    throw error instanceof Error
      ? error
      : new Error("Failed to open billing portal")
  }
}

const getSubscription = async (subscriptionId: string) => {
  return stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["default_payment_method"]
  })
}

export const updateStripeCustomer = async (
  userId: string,
  subscriptionId: string,
  customerId: string
) => {
  try {
    if (!userId || !subscriptionId || !customerId) {
      throw new Error("Missing required parameters for updateStripeCustomer")
    }

    const subscription = await getSubscription(subscriptionId)

    // Check if customer exists
    const existingCustomer = await getCustomerByUserId(userId)
    
    let result
    if (!existingCustomer) {
      // Create customer first
      const createResult = await createCustomer(userId)
      if (!createResult.isSuccess) {
        throw new Error("Failed to create customer profile")
      }
      
      // Then update with Stripe data
      result = await updateCustomerByUserId(userId, {
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscription.id
      })
    } else {
      // Customer exists, just update
      result = await updateCustomerByUserId(userId, {
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscription.id
      })
    }

    if (!result.isSuccess) {
      throw new Error("Failed to update customer profile")
    }

    return result.data
  } catch (error) {
    console.error("Error in updateStripeCustomer:", error)
    throw error instanceof Error
      ? error
      : new Error("Failed to update Stripe customer")
  }
}

export const manageSubscriptionStatusChange = async (
  subscriptionId: string,
  customerId: string,
  productId: string
): Promise<MembershipStatus> => {
  try {
    if (!subscriptionId || !customerId || !productId) {
      throw new Error(
        "Missing required parameters for manageSubscriptionStatusChange"
      )
    }

    const subscription = await getSubscription(subscriptionId)
    const product = await stripe.products.retrieve(productId)

    const membership = product.metadata?.membership

    if (!membership || !["free", "pro"].includes(membership)) {
      throw new Error(
        `Invalid or missing membership type in product metadata: ${membership}`
      )
    }

    const validatedMembership = membership as MembershipStatus

    const membershipStatus = getMembershipStatus(
      subscription.status,
      validatedMembership
    )

    const updateResult = await updateCustomerByStripeCustomerId(customerId, {
      stripeSubscriptionId: subscription.id,
      membership: membershipStatus
    })

    if (!updateResult.isSuccess) {
      throw new Error("Failed to update subscription status")
    }

    return membershipStatus
  } catch (error) {
    console.error("Error in manageSubscriptionStatusChange:", error)
    throw error instanceof Error
      ? error
      : new Error("Failed to update subscription status")
  }
}

export const createCheckoutUrl = async (
  paymentLinkUrl: string
): Promise<{ url: string | null; error: string | null }> => {
  try {
    const { userId } = await auth()

    if (!userId) {
      return { url: null, error: "User must be authenticated" }
    }

    if (!paymentLinkUrl) {
      return { url: null, error: "Payment link URL is required" }
    }

    // Add client_reference_id to the Stripe payment link
    const url = new URL(paymentLinkUrl)
    url.searchParams.set("client_reference_id", userId)

    return { url: url.toString(), error: null }
  } catch (error) {
    console.error("Error creating checkout URL:", error)
    return {
      url: null,
      error:
        error instanceof Error ? error.message : "Failed to create checkout URL"
    }
  }
}
