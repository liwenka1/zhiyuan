import { LandingPage } from "@/components/landing-page";
import { getTranslations } from "@/lib/i18n";

export default function Home() {
  const language = "zh" as const;
  const t = getTranslations(language);

  return <LandingPage language={language} t={t} />;
}
