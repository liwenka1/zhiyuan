import { LandingPage } from "@/components/landing-page";
import { getTranslations } from "@/lib/i18n";

export default function EnglishHome() {
  const language = "en" as const;
  const t = getTranslations(language);

  return <LandingPage language={language} t={t} />;
}
