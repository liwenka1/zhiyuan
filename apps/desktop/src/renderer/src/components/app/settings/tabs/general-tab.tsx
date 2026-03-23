/**
 * 通用设置 Tab — 主题 & 语言
 */

import { Sun, Monitor, Moon } from "lucide-react";
import { useThemeStore, useLanguageStore } from "@/stores";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { ThemeMode } from "@shared";
import { SettingRow } from "../shared/setting-row";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
    <div className="inline-flex rounded-lg bg-muted/50 p-1">
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
  const currentLabel = LANGUAGES.find((lang) => lang.value === language)?.label ?? language;

  const handleSelect = (lang: "zh" | "en") => {
    if (lang !== language) {
      toggleLanguage();
      void i18n.changeLanguage(lang);
    }
  };

  return (
    <Select
      value={language}
      onValueChange={(value) => {
        if (!value) return;
        handleSelect(value as "zh" | "en");
      }}
    >
      <SelectTrigger size="sm" className="h-8 min-w-32 rounded-lg px-3 text-xs">
        <SelectValue>{currentLabel}</SelectValue>
      </SelectTrigger>
      <SelectContent align="start" alignItemWithTrigger={false} className="min-w-0">
        {LANGUAGES.map((lang) => (
          <SelectItem key={lang.value} value={lang.value}>
            {lang.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/* ---------- 通用 Tab ---------- */
export function GeneralTab() {
  const { t } = useTranslation("common");

  return (
    <div className="space-y-2">
      <SettingRow label={t("settings.theme")}>
        <ThemeSegmentedControl />
      </SettingRow>
      <SettingRow label={t("settings.language")}>
        <LanguageSelect />
      </SettingRow>
    </div>
  );
}
