import { useMemo } from "react";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getUnsupportedLayoutFieldsForFormat } from "@/features/export/lib";
import { useTranslation } from "react-i18next";

export function ExportPreviewHint() {
  const { t } = useTranslation("common");
  const wechatUnsupportedFields = useMemo(() => getUnsupportedLayoutFieldsForFormat("wechat"), []);
  const wechatUnsupportedFieldLabels = useMemo(
    () => wechatUnsupportedFields.map((field) => t(`settings.exportLayoutFields.${field}`)),
    [t, wechatUnsupportedFields]
  );
  const exportPreviewHint = useMemo(
    () => t("settings.exportPreviewHint", { fields: wechatUnsupportedFieldLabels.join(" / ") }),
    [t, wechatUnsupportedFieldLabels]
  );

  return (
    <div className="text-muted-foreground mb-3 flex items-center gap-1.5 text-xs font-medium">
      <span>{t("settings.exportPreview")}</span>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger
            aria-label={exportPreviewHint}
            className="text-muted-foreground/80 hover:text-foreground focus-visible:ring-ring/50 inline-flex cursor-help items-center rounded-sm transition-colors outline-none focus-visible:ring-[3px]"
          >
            <Info className="h-3.5 w-3.5" />
          </TooltipTrigger>
          <TooltipContent className="max-w-72">{exportPreviewHint}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
