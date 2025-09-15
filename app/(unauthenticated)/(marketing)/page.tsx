import { CompaniesSection } from "./_components/sections/companies-section"
import { CTASection } from "./_components/sections/cta-section"
import { FAQSection } from "./_components/sections/faq-section"
import { FeaturesSection } from "./_components/sections/features-section"
import { HeroSection } from "./_components/sections/hero-section"
import { PricingSection } from "./_components/sections/pricing-section"
import { SocialProofSection } from "./_components/sections/social-proof-section"
import { VideoSection } from "./_components/sections/video-section"
import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"

export default async function MarketingPage() {
  // If a user is already signed in, send them to the dashboard
  const { userId } = await auth()
  if (userId) {
    redirect("/dashboard")
  }
  return (
    <main className="min-h-screen">
      <HeroSection />
      <CompaniesSection />
      <VideoSection />
      <FeaturesSection />
      <SocialProofSection />
      <PricingSection />
      <FAQSection />
      <CTASection />
    </main>
  )
}
