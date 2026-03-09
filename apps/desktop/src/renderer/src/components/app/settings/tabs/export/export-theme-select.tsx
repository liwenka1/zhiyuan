import { useExportThemeStore } from "@/stores";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { EXPORT_THEME_PRESETS } from "@/features/export/lib/styles";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function ExportThemeSelect() {
  const exportThemeId = useExportThemeStore((state) => state.exportThemeId);
  const setExportThemeId = useExportThemeStore((state) => state.setExportThemeId);
  const { t } = useTranslation("common");

  const currentPreset = EXPORT_THEME_PRESETS.find((p) => p.id === exportThemeId) ?? EXPORT_THEME_PRESETS[0];

  const handleSelect = (id: string) => {
    setExportThemeId(id);
  };

  return (
    <Select
      value={currentPreset.id}
      onValueChange={(value) => {
        if (!value) return;
        handleSelect(value);
      }}
    >
      <SelectTrigger size="sm" className="h-8 min-w-44 gap-3 rounded-lg px-3 text-xs">
        <div className="flex items-center gap-2.5">
          <span
            className="h-3 w-3 shrink-0 rounded-full border"
            style={{ backgroundColor: currentPreset.colors.linkColor, borderColor: currentPreset.colors.border }}
          />
          <SelectValue>{t(`settings.exportThemes.${currentPreset.id}`)}</SelectValue>
        </div>
      </SelectTrigger>
      <SelectContent align="start" alignItemWithTrigger={false} className="min-w-0">
        {EXPORT_THEME_PRESETS.map((preset) => (
          <SelectItem
            key={preset.id}
            className={cn(
              "h-8 w-full justify-start gap-2.5 rounded-md px-3 text-sm",
              exportThemeId === preset.id ? "text-foreground font-medium" : "text-muted-foreground"
            )}
            value={preset.id}
          >
            <span
              className="h-3 w-3 shrink-0 rounded-full border"
              style={{ backgroundColor: preset.colors.linkColor, borderColor: preset.colors.border }}
            />
            <span className="flex-1 text-left">{t(`settings.exportThemes.${preset.id}`)}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
