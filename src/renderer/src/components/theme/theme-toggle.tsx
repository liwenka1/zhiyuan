import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useThemeStore } from "@/stores/use-theme-store";
import { useTranslation } from "react-i18next";

export function ThemeToggle() {
  const theme = useThemeStore((state) => state.theme);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);
  const { t } = useTranslation("common");

  // 根据当前主题显示对应图标
  const Icon = theme === "light" ? Sun : Moon;

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-8 w-8 p-0"
      onClick={toggleTheme}
      aria-label={t("theme." + theme)}
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
}
