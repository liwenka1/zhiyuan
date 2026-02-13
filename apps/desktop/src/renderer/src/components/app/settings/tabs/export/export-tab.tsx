/**
 * 导出设置 Tab — 主题选择 & 布局配置
 */

import { useMemo } from "react";
import { useExportLayoutStore } from "@/stores";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { DEFAULT_EXPORT_LAYOUT_CONFIG } from "@shared";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info, RotateCcw } from "lucide-react";
import { getUnsupportedLayoutFieldsForFormat } from "@/features/export/lib";
import { SettingRow } from "../../shared/setting-row";
import { SettingSection } from "../../shared/setting-section";
import { ExportThemeSelect } from "./export-theme-select";
import { ExportLayoutControls } from "./export-layout-controls";

export function ExportTab() {
  const { t } = useTranslation("common");
  const setExportLayout = useExportLayoutStore((state) => state.setExportLayout);
  const wechatUnsupportedFields = useMemo(() => getUnsupportedLayoutFieldsForFormat("wechat"), []);
  const wechatUnsupportedFieldLabels = useMemo(
    () => wechatUnsupportedFields.map((field) => t(`settings.exportLayoutFields.${field}`)),
    [t, wechatUnsupportedFields]
  );
  const exportPreviewHint = useMemo(
    () => t("settings.exportPreviewHint", { fields: wechatUnsupportedFieldLabels.join(" / ") }),
    [t, wechatUnsupportedFieldLabels]
  );

  const handleResetLayout = async () => {
    const ok = await setExportLayout(DEFAULT_EXPORT_LAYOUT_CONFIG);
    if (ok) {
      toast.success(t("settings.exportLayoutResetSuccess"));
      return;
    }
    toast.error(t("settings.exportLayoutResetFailed"));
  };

  return (
    <div>
      <SettingSection title={t("settings.exportThemeSectionTitle")} description={t("settings.exportThemeDesc")}>
        <SettingRow label={t("settings.exportTheme")}>
          <ExportThemeSelect />
        </SettingRow>
      </SettingSection>

      <SettingSection
        title={t("settings.exportLayoutSectionTitle")}
        action={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 px-2.5 text-xs"
            onClick={handleResetLayout}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {t("settings.exportLayoutReset")}
          </Button>
        }
      >
        <Alert className="mb-3">
          <Info className="text-muted-foreground mt-0.5 h-4 w-4" />
          <AlertTitle>{t("settings.wechatLayoutNoticeTitle")}</AlertTitle>
          <AlertDescription>{exportPreviewHint}</AlertDescription>
        </Alert>
        <ExportLayoutControls />
      </SettingSection>
    </div>
  );
}
