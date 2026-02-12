import { useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useExportThemeStore } from "@/stores";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { EXPORT_THEME_PRESETS } from "@/features/export/lib/styles";

export function ExportThemeSelect() {
  const exportThemeId = useExportThemeStore((state) => state.exportThemeId);
  const setExportThemeId = useExportThemeStore((state) => state.setExportThemeId);
  const { t } = useTranslation("common");
  const [open, setOpen] = useState(false);

  const currentPreset = EXPORT_THEME_PRESETS.find((p) => p.id === exportThemeId) ?? EXPORT_THEME_PRESETS[0];
  const currentLabel = t(`settings.exportThemes.${currentPreset.id}`);

  const handleSelect = (id: string) => {
    setExportThemeId(id);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-3 rounded-lg px-3 text-xs">
          <span
            className="h-3 w-3 shrink-0 rounded-full border"
            style={{ backgroundColor: currentPreset.colors.linkColor, borderColor: currentPreset.colors.border }}
          />
          <span>{currentLabel}</span>
          <ChevronDown className="text-muted-foreground h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={4} className="w-44 gap-0 p-1">
        {EXPORT_THEME_PRESETS.map((preset) => (
          <Button
            key={preset.id}
            variant="ghost"
            size="sm"
            onClick={() => handleSelect(preset.id)}
            className={cn(
              "h-8 w-full justify-start gap-2.5 rounded-md px-3 text-sm transition-colors",
              exportThemeId === preset.id ? "text-foreground font-medium" : "text-muted-foreground"
            )}
          >
            <span
              className="h-3 w-3 shrink-0 rounded-full border"
              style={{ backgroundColor: preset.colors.linkColor, borderColor: preset.colors.border }}
            />
            <span className="flex-1 text-left">{t(`settings.exportThemes.${preset.id}`)}</span>
            {exportThemeId === preset.id && <Check className="h-3.5 w-3.5 shrink-0" />}
          </Button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
