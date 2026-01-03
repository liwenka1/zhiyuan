"use client";

import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/use-language";

export function LanguageToggle() {
  const { language, toggleLanguage } = useLanguage();

  return (
    <Button variant="ghost" size="icon" onClick={toggleLanguage}>
      <span className="text-sm font-medium">{language === "zh" ? "中" : "EN"}</span>
      <span className="sr-only">切换语言</span>
    </Button>
  );
}
