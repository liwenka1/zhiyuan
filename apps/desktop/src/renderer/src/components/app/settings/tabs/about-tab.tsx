/**
 * 关于 Tab — Logo & 版本信息
 */

import { useTranslation } from "react-i18next";
import { Logo } from "@/components/icons";

export function AboutTab() {
  const { t } = useTranslation("common");
  const { t: tEditor } = useTranslation("editor");

  return (
    <div className="flex min-h-90 flex-1 flex-col items-center justify-center gap-6">
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
