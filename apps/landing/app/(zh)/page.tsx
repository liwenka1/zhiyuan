import type { Metadata } from "next";
import { LandingPage } from "@/components/landing-page";
import { getTranslations } from "@/lib/i18n";
import { createLandingMetadata } from "@/lib/metadata";

export const metadata: Metadata = createLandingMetadata({
  title: "纸鸢笔记",
  description: "本地优先的 Markdown 内容工作台，支持采集、写作、导出与发布。",
  canonical: "/",
  locale: "zh_CN"
});

export default function Home() {
  const language = "zh" as const;
  const t = getTranslations(language);

  return <LandingPage language={language} t={t} />;
}