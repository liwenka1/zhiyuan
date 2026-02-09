/**
 * 通用设置 Tab — 主题 & 语言
 */

import { useState } from "react";
import { Sun, Monitor, Moon, ChevronDown, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useThemeStore, useLanguageStore } from "@/stores";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { ThemeMode } from "@shared";
import { SettingRow } from "./setting-row";

/* ---------- 主题分段控件 ---------- */
function ThemeSegmentedControl() {
  const themeMode = useThemeStore((state) => state.themeMode);
  const setTheme = useThemeStore((state) => state.setTheme);
  const { t } = useTranslation("common");

  const options: { value: ThemeMode; label: string; icon: React.ReactNode }[] = [
    { value: "light", label: t("theme.light"), icon: <Sun className="h-3.5 w-3.5" /> },
    { value: "system", label: t("theme.system"), icon: <Monitor className="h-3.5 w-3.5" /> },
    { value: "dark", label: t("theme.dark"), icon: <Moon className="h-3.5 w-3.5" /> }
  ];

  return (
    <div className="bg-muted/50 inline-flex rounded-lg p-1">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => setTheme(option.value)}
          className={cn(
            "flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all",
            themeMode === option.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- 语言下拉选择 ---------- */
const LANGUAGES = [
  { value: "zh", label: "中文" },
  { value: "en", label: "English" }
] as const;

function LanguageSelect() {
  const { language, toggleLanguage } = useLanguageStore();
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);

  const currentLabel = LANGUAGES.find((l) => l.value === language)?.label ?? language;

  const handleSelect = (lang: "zh" | "en") => {
    if (lang !== language) {
      toggleLanguage();
      i18n.changeLanguage(lang);
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="border-border hover:bg-muted/40 inline-flex cursor-pointer items-center gap-6 rounded-lg border px-3 py-1.5 text-xs transition-colors">
          <span>{currentLabel}</span>
          <ChevronDown className="text-muted-foreground h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={4} className="w-36 gap-0 p-1">
        {LANGUAGES.map((lang) => (
          <button
            key={lang.value}
            onClick={() => handleSelect(lang.value)}
            className={cn(
              "flex w-full cursor-pointer items-center justify-between rounded-md px-3 py-2 text-sm transition-colors",
              language === lang.value ? "text-foreground font-medium" : "text-muted-foreground hover:bg-muted/40"
            )}
          >
            {lang.label}
            {language === lang.value && <Check className="h-3.5 w-3.5" />}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

/* ---------- 通用 Tab ---------- */
export function GeneralTab() {
  const { t } = useTranslation("common");

  return (
    <div className="divide-border divide-y">
      <SettingRow label={t("settings.theme")}>
        <ThemeSegmentedControl />
      </SettingRow>
      <SettingRow label={t("settings.language")}>
        <LanguageSelect />
      </SettingRow>
    </div>
  );
}
