import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useLanguageStore } from "@/stores/use-language-store";
import { useTranslation } from "react-i18next";

export function LanguageToggle() {
  const { language, toggleLanguage } = useLanguageStore();
  const { i18n, t } = useTranslation("common");

  const handleToggle = () => {
    const newLang = language === "zh" ? "en" : "zh";
    toggleLanguage();
    i18n.changeLanguage(newLang); // 同步 i18next
  };

  const tooltipText = t("language.current");

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={handleToggle}
            aria-label={t("language.switch")}
          >
            <Languages className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
