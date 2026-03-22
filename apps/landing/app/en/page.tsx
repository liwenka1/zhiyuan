import { Header } from "@/components/header";
import { Hero } from "@/components/hero";
import { Features } from "@/components/features";
import { UseCase } from "@/components/usecase";
import { CTA } from "@/components/cta";
import { Footer } from "@/components/footer";
import { getTranslations } from "@/lib/i18n";

export default function EnglishHome() {
  const language = "en" as const;
  const t = getTranslations(language);

  return (
    <div className="min-h-screen">
      <Header language={language} t={t} />
      <main>
        <Hero t={t.hero} />
        <Features t={t.features} />
        <UseCase t={t.usecase} />
        <CTA t={t.cta} />
      </main>
      <Footer t={t.footer} />
    </div>
  );
}