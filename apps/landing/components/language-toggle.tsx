import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import type { Language } from "@/lib/i18n";

interface LanguageToggleProps {
  language: Language;
}

export function LanguageToggle({ language }: LanguageToggleProps) {
  const nextLanguage = language === "zh" ? "en" : "zh";
  const href = nextLanguage === "en" ? "/en" : "/";

  return (
    <Link href={href} className={buttonVariants({ variant: "ghost", size: "icon-sm" })} aria-label="切换语言">
      <span className="text-sm font-medium">{language === "zh" ? "中" : "EN"}</span>
      <span className="sr-only">切换语言</span>
    </Link>
  );
}
