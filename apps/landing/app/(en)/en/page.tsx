import type { Metadata } from "next";
import { LandingPage } from "@/components/landing-page";
import { getTranslations } from "@/lib/i18n";
import { createLandingMetadata } from "@/lib/metadata";

export const metadata: Metadata = createLandingMetadata({
  title: "Zhiyuan",
  description: "A local-first Markdown workspace for capture, writing, export, and publishing.",
  canonical: "/en",
  locale: "en_US"
});

export default function EnglishHome() {
  const language = "en" as const;
  const t = getTranslations(language);

  return <LandingPage language={language} t={t} />;
}
