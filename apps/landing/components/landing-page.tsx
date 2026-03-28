import { CTA } from "@/components/cta";
import { DesktopDetails } from "@/components/desktop-details";
import { Features } from "@/components/features";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { Hero } from "@/components/hero";
import { ProductPreview } from "@/components/product-preview";
import { ProofGrid } from "@/components/proof-grid";
import { UseCase } from "@/components/usecase";
import type { Language, TranslationKey } from "@/lib/i18n";

interface LandingPageProps {
  language: Language;
  t: TranslationKey;
}

export function LandingPage({ language, t }: LandingPageProps) {
  return (
    <div id="top" className="min-h-screen bg-background text-foreground">
      <Header language={language} t={t} />
      <main>
        <Hero t={t.hero} />
        <ProofGrid t={t.proof} />
        <ProductPreview t={t.preview} />
        <Features t={t.features} />
        <DesktopDetails t={t.desktopDetails} />
        <UseCase t={t.usecase} />
        <CTA t={t.cta} />
      </main>
      <Footer t={t.footer} brandName={t.brand.name} />
    </div>
  );
}