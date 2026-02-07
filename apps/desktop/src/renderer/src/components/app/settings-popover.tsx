import { useState } from "react";
import { Settings, Moon, Sun, Monitor, Info, SlidersHorizontal, ChevronDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useThemeStore, useLanguageStore } from "@/stores";
import { useTranslation } from "react-i18next";
import { Logo } from "@/components/icons";
import { cn } from "@/lib/utils";
import type { ThemeMode } from "@shared";

type SettingsTab = "general" | "about";

/* ---------- 设置行容器 ---------- */
function SettingRow({
  label,
  description,
  children
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-8 py-4">
      <div className="shrink-0">
        <div className="text-foreground text-sm font-medium">{label}</div>
        {description && <div className="text-muted-foreground mt-0.5 text-xs">{description}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

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
function GeneralTab() {
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

/* ---------- 关于 Tab ---------- */
function AboutTab() {
  const { t } = useTranslation("common");
  const { t: tEditor } = useTranslation("editor");

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6">
      <Logo className="text-foreground/8 h-24 w-24" />
      <div className="text-center">
        <div className="text-foreground text-xl font-light tracking-wide">{tEditor("appName")}</div>
        <div className="text-muted-foreground/50 mt-2 text-sm">
          {t("settings.version")} {__APP_VERSION__}
        </div>
      </div>
    </div>
  );
}

/* ---------- 设置弹窗 ---------- */
export function SettingsPopover() {
  const [tab, setTab] = useState<SettingsTab>("general");
  const { t } = useTranslation("common");

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: "general", label: t("settings.general"), icon: <SlidersHorizontal className="h-4 w-4" /> },
    { id: "about", label: t("settings.about"), icon: <Info className="h-4 w-4" /> }
  ];

  const activeTab = tabs.find((item) => item.id === tab);

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 focus-visible:border-transparent focus-visible:ring-0"
            aria-label={t("settings.title")}
          />
        }
      >
        <Settings className="h-4 w-4" />
      </DialogTrigger>
      <DialogContent className="flex h-[70vh] max-h-[600px] min-h-[480px] gap-0 overflow-hidden p-0 sm:max-w-[800px]">
        <DialogTitle className="sr-only">{t("settings.title")}</DialogTitle>

        {/* 左侧导航 */}
        <nav className="border-border flex w-[200px] shrink-0 flex-col gap-0.5 border-r px-3 py-4">
          {tabs.map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={cn(
                "relative flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors",
                tab === item.id
                  ? "bg-foreground/6 text-foreground font-medium"
                  : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        {/* 右侧内容 */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* 内容区标题 */}
          <div className="border-border flex shrink-0 items-center gap-2.5 border-b px-8 py-5">
            {activeTab && (
              <>
                <span className="text-muted-foreground">{activeTab.icon}</span>
                <h2 className="text-foreground text-base font-medium">{activeTab.label}</h2>
              </>
            )}
          </div>

          {/* 内容区主体 */}
          <div className="flex flex-1 flex-col overflow-y-auto px-8 py-4">
            {tab === "general" && <GeneralTab />}
            {tab === "about" && <AboutTab />}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
