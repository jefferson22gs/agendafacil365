import { Navbar } from "@/components/landing/Navbar";
import { HeroSection } from "@/components/landing/HeroSection";
import { PartnersSection } from "@/components/landing/PartnersSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { ProfilesSection } from "@/components/landing/ProfilesSection";
import { TestimonialsSection } from "@/components/landing/TestimonialsSection";
import { PricingSection } from "@/components/landing/PricingSection";
import { FAQSection } from "@/components/landing/FAQSection";
import { CTASection } from "@/components/landing/CTASection";
import { Footer } from "@/components/landing/Footer";
import { FloatingChat } from "@/components/landing/FloatingChat";
import { VideoSection } from "@/components/landing/VideoSection";

// TestimonialsSection agora é "Como funciona" (sem depoimentos).
const Index = () => {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      <Navbar />
      <main>
        <HeroSection />
        <VideoSection />
        <PartnersSection />
        <FeaturesSection />
        <TestimonialsSection />
        <ProfilesSection />
        <PricingSection />
        <FAQSection />
        <CTASection />
      </main>
      <Footer />
      <FloatingChat />
    </div>
  );
};

export default Index;
