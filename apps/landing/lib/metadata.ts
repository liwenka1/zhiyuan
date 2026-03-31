import type { Metadata } from "next";

type LandingMetadataOptions = {
  title: string;
  description: string;
  canonical: "/" | "/en";
  locale: "zh_CN" | "en_US";
};

export function createLandingMetadata(options: LandingMetadataOptions): Metadata {
  const { title, description, canonical, locale } = options;

  return {
    title,
    description,
    alternates: {
      canonical,
      languages: {
        "zh-CN": "/",
        en: "/en"
      }
    },
    openGraph: {
      title,
      description,
      type: "website",
      locale,
      siteName: "Zhiyuan"
    },
    twitter: {
      card: "summary",
      title,
      description
    }
  };
}
