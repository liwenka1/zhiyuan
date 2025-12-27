import { Button } from "@/components/ui/button";
import { useLanguageStore } from "@/stores";
import { useTranslation } from "react-i18next";

export function LanguageToggle() {
  const { language, toggleLanguage } = useLanguageStore();
  const { i18n, t } = useTranslation("common");

  const handleToggle = () => {
    const newLang = language === "zh" ? "en" : "zh";
    toggleLanguage();
    i18n.changeLanguage(newLang); // 同步 i18next
  };

  return (
    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={handleToggle} aria-label={t("language.switch")}>
      {language === "zh" ? "中" : "EN"}
    </Button>
  );
}
