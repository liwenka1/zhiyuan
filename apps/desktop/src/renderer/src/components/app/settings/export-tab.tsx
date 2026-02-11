/**
 * 导出设置 Tab — 主题选择 & 预览
 */

import { useMemo } from "react";
import { useExportThemeStore } from "@/stores";
import { useTranslation } from "react-i18next";
import { getExportThemeColors } from "@/features/export/lib/styles";
import { SettingRow } from "./setting-row";
import { SettingSection } from "./setting-section";
import { ExportThemeSelect } from "./export-theme-select";
import { ExportThemePreview } from "./export-theme-preview";
import { ExportPreviewHint } from "./export-preview-hint";

export function ExportTab() {
  const { t } = useTranslation("common");
  const exportThemeId = useExportThemeStore((state) => state.exportThemeId);
  const colors = useMemo(() => getExportThemeColors(exportThemeId), [exportThemeId]);

  return (
    <div>
      <SettingSection title={t("settings.exportThemeSectionTitle")} description={t("settings.exportThemeDesc")}>
        <SettingRow label={t("settings.exportTheme")}>
          <ExportThemeSelect />
        </SettingRow>
      </SettingSection>

      <SettingSection title={t("settings.exportPreviewSectionTitle")}>
        <ExportPreviewHint />
        <ExportThemePreview colors={colors} />
      </SettingSection>

      <SettingSection title={t("settings.exportLayoutSectionTitle")} notice={t("settings.exportLayoutSectionNotice")}>
        <div className="border-border bg-muted/20 text-muted-foreground rounded-md border border-dashed px-3 py-4 text-xs">
          {t("settings.exportLayoutComingSoon")}
        </div>
      </SettingSection>
    </div>
  );
}
