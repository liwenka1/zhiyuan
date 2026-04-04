import type { Metadata } from "next";

type LandingMetadataOptions = {
  title: string;
  description: string;
  canonical: "/" | "/en";
  locale: "zh_CN" | "en_US";
};

function getMetadataBase() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (siteUrl) {
    return new URL(siteUrl);
  }

  const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercelUrl) {
    return new URL(`https://${vercelUrl}`);
  }

  return new URL("http://localhost:3000");
}

export function createLandingMetadata(options: LandingMetadataOptions): Metadata {
  const { title, description, canonical, locale } = options;
  const brandName = locale === "zh_CN" ? "纸鸢" : "Zhiyuan";

  return {
    metadataBase: getMetadataBase(),
    applicationName: brandName,
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
      siteName: brandName
    },
    twitter: {
      card: "summary",
      title,
      description
    }
  };
}
