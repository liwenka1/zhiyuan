import { useExportLayoutStore } from "@/stores";
import { useTranslation } from "react-i18next";
import { SettingRow } from "../../shared/setting-row";
import { ExportLayoutColorInput } from "./export-layout-color-input";
import { ExportLayoutNumberSliderInput } from "./export-layout-number-slider-input";

export function ExportLayoutControls() {
  const { t } = useTranslation("common");
  const exportLayout = useExportLayoutStore((state) => state.exportLayout);
  const setExportLayout = useExportLayoutStore((state) => state.setExportLayout);

  return (
    <>
      <SettingRow
        label={t("settings.exportLayoutFields.baseFontSize")}
        description={t("settings.exportLayoutDescriptions.baseFontSize")}
      >
        <ExportLayoutNumberSliderInput
          ariaLabel={t("settings.exportLayoutFields.baseFontSize")}
          unit="px"
          value={exportLayout.baseFontSize}
          min={12}
          max={24}
          onChange={(next) => setExportLayout({ baseFontSize: next })}
        />
      </SettingRow>

      <SettingRow
        label={t("settings.exportLayoutFields.contentWidth")}
        description={t("settings.exportLayoutDescriptions.contentWidth")}
      >
        <ExportLayoutNumberSliderInput
          ariaLabel={t("settings.exportLayoutFields.contentWidth")}
          unit="px"
          value={exportLayout.contentWidth}
          min={320}
          max={1600}
          onChange={(next) => setExportLayout({ contentWidth: next })}
        />
      </SettingRow>

      <SettingRow
        label={t("settings.exportLayoutFields.cardPadding")}
        description={t("settings.exportLayoutDescriptions.cardPadding")}
      >
        <ExportLayoutNumberSliderInput
          ariaLabel={t("settings.exportLayoutFields.cardPadding")}
          unit="px"
          value={exportLayout.cardPadding}
          min={0}
          max={96}
          onChange={(next) => setExportLayout({ cardPadding: next })}
        />
      </SettingRow>

      <SettingRow
        label={t("settings.exportLayoutFields.outerBackground")}
        description={t("settings.exportLayoutDescriptions.outerBackground")}
      >
        <ExportLayoutColorInput
          value={exportLayout.outerBackground}
          onChange={(next) => setExportLayout({ outerBackground: next })}
        />
      </SettingRow>

      <SettingRow
        label={t("settings.exportLayoutFields.innerBackground")}
        description={t("settings.exportLayoutDescriptions.innerBackground")}
      >
        <ExportLayoutColorInput
          value={exportLayout.innerBackground}
          onChange={(next) => setExportLayout({ innerBackground: next })}
        />
      </SettingRow>
    </>
  );
}
