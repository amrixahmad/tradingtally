import { getBillingDataByUserId } from "@/actions/customers"
import { getUserSubscriptionSummary, openBillingPortal } from "@/actions/stripe"
import { Button } from "@/components/ui/button"
import { auth } from "@clerk/nextjs/server"
import { AlertCircle, CreditCard } from "lucide-react"
import { PricingButton } from "@/components/payments/pricing-button"

export default async function BillingPage() {
  const { userId } = await auth()

  if (!userId) {
    return (
      <div>
        <div className="bg-destructive/10 flex items-center gap-3 rounded-lg p-4">
          <AlertCircle className="text-destructive h-5 w-5" />
          <p className="text-foreground text-sm">
            Unable to load billing information. Please try again.
          </p>
        </div>
      </div>
    )
  }

  const customerResponse = await getBillingDataByUserId(userId)
  const customerData = customerResponse.customer
  const subSummary = await getUserSubscriptionSummary(userId)

  if (!customerData) {
    return (
      <div>
        <div className="flex items-center gap-3 rounded-lg bg-yellow-50 p-4 dark:bg-yellow-900/20">
          <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            Please complete your profile setup to access billing information.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Page Header */}
      <div className="space-y-2">
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <CreditCard className="text-muted-foreground h-8 w-8" />
          Billing
        </h1>
        <p className="text-muted-foreground">
          Manage your subscription and billing information
        </p>
      </div>

      <div className="mt-8">
        <h2 className="text-2xl font-bold">Subscription Details</h2>
        <p className="text-muted-foreground">
          Your current subscription plan is{" "}
          <span className="font-medium">{customerData.membership}</span>.
        </p>
        {subSummary && (
          <div className="mt-2 space-y-2 text-sm text-muted-foreground">
            <div>
              <span className="font-medium">Status:</span> {subSummary.status}
            </div>
            {subSummary.cancelAtPeriodEnd && (
              <div className="bg-yellow-50 text-yellow-900 dark:bg-yellow-900/20 dark:text-yellow-200 rounded-md p-3">
                <span className="font-medium">Cancellation scheduled.</span>{" "}
                {typeof subSummary.currentPeriodEnd === "number" ? (
                  <>
                    Your subscription will end on {new Date(subSummary.currentPeriodEnd * 1000).toLocaleDateString()}.
                  </>
                ) : (
                  <>
                    Your subscription is set to cancel at the end of the current period.
                  </>
                )}
              </div>
            )}
            {!subSummary.cancelAtPeriodEnd && typeof subSummary.currentPeriodEnd === "number" && (
              <div>
                Renews on {new Date(subSummary.currentPeriodEnd * 1000).toLocaleDateString()}
              </div>
            )}

            {subSummary.paymentMethod && (
              <div className="text-xs text-muted-foreground">
                <span className="font-medium">Payment method:</span>{" "}
                {subSummary.paymentMethod.brand?.toUpperCase()} •••• {subSummary.paymentMethod.last4}
                {subSummary.paymentMethod.expMonth && subSummary.paymentMethod.expYear && (
                  <span>
                    {" "}exp {String(subSummary.paymentMethod.expMonth).padStart(2, "0")}/{subSummary.paymentMethod.expYear}
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-6">
        {customerData.stripeCustomerId ? (
          <form action={openBillingPortal}>
            <Button type="submit" variant="outline">
              Manage Billing
            </Button>
          </form>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertCircle className="h-4 w-4" />
              <span>No payment method on file yet. Upgrade to Pro to manage billing.</span>
            </div>
            {process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_PRO ? (
              <PricingButton
                paymentLink={process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_PRO}
                variant="default"
              >
                Upgrade to Pro
              </PricingButton>
            ) : (
              <p className="text-sm text-destructive">
                Missing NEXT_PUBLIC_STRIPE_PAYMENT_LINK_PRO. Set it in your environment to enable upgrades.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
