/**
 * 导出设置 Tab — 主题选择 & 预览
 */

import { useState, useMemo, memo } from "react";
import { ChevronDown, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useExportThemeStore } from "@/stores";
import { useTranslation, Trans } from "react-i18next";
import { Logo } from "@/components/icons";
import { cn } from "@/lib/utils";
import { EXPORT_THEME_PRESETS, getExportThemeColors, type ThemeColors } from "@/features/export/lib/styles";
import { SettingRow } from "./setting-row";

/* ---------- 导出主题选择器 ---------- */
function ExportThemeSelect() {
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
        <button className="border-border hover:bg-muted/40 inline-flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-1.5 text-xs transition-colors">
          <span
            className="h-3 w-3 shrink-0 rounded-full border"
            style={{ backgroundColor: currentPreset.colors.linkColor, borderColor: currentPreset.colors.border }}
          />
          <span>{currentLabel}</span>
          <ChevronDown className="text-muted-foreground h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={4} className="w-44 gap-0 p-1">
        {EXPORT_THEME_PRESETS.map((preset) => (
          <button
            key={preset.id}
            onClick={() => handleSelect(preset.id)}
            className={cn(
              "flex w-full cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
              exportThemeId === preset.id ? "text-foreground font-medium" : "text-muted-foreground hover:bg-muted/40"
            )}
          >
            <span
              className="h-3 w-3 shrink-0 rounded-full border"
              style={{ backgroundColor: preset.colors.linkColor, borderColor: preset.colors.border }}
            />
            <span className="flex-1 text-left">{t(`settings.exportThemes.${preset.id}`)}</span>
            {exportThemeId === preset.id && <Check className="h-3.5 w-3.5 shrink-0" />}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

/* ---------- 色彩总览条 ---------- */
function ColorPaletteStrip({ colors }: { colors: ThemeColors }) {
  const { t } = useTranslation("common");

  const swatches = [
    { color: colors.background, label: t("settings.palette.bg") },
    { color: colors.h1Color, label: t("settings.palette.title") },
    { color: colors.linkColor, label: t("settings.palette.link") },
    { color: colors.blockquoteBorder, label: t("settings.palette.accent") },
    { color: colors.codeColor, label: t("settings.palette.code") },
    { color: colors.quoteColor, label: t("settings.palette.quote") }
  ];

  return (
    <div
      className="flex items-center gap-3 border-b px-4 py-2.5"
      style={{ borderColor: colors.border, backgroundColor: colors.muted }}
    >
      {swatches.map((s) => (
        <div key={s.label} className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{
              backgroundColor: s.color,
              border: `1px solid ${colors.border}`,
              boxShadow: "0 0 0 1px rgba(0,0,0,0.04)"
            }}
          />
          <span style={{ fontSize: "9px", color: colors.mutedForeground, fontWeight: 500 }}>{s.label}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------- 预览区块子组件 ---------- */
/**
 * 以下子组件使用 inline style 而非 Tailwind —— 因为颜色值来自主题预设对象，
 * 是运行时动态值（非 Tailwind 的静态 token），无法使用 Tailwind 的工具类。
 */

function PreviewHeading({ colors }: { colors: ThemeColors }) {
  const { t } = useTranslation("common");

  return (
    <>
      {/* h1: Logo + 项目名 + 装饰线 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          paddingBottom: "6px",
          borderBottom: `2px solid ${colors.h1Decoration}`,
          marginBottom: "12px"
        }}
      >
        <Logo style={{ width: "20px", height: "20px", color: colors.h1Color, flexShrink: 0 }} />
        <span style={{ color: colors.h1Color, fontWeight: 700, fontSize: "16px", letterSpacing: "-0.01em" }}>
          {t("settings.preview.appName")}
        </span>
      </div>

      {/* h2 + 装饰线 */}
      <div
        style={{
          color: colors.h2Color,
          fontWeight: 600,
          fontSize: "12.5px",
          paddingLeft: "10px",
          borderLeft: `3px solid ${colors.h2Decoration}`,
          marginBottom: "10px"
        }}
      >
        {t("settings.preview.subtitle")}
      </div>
    </>
  );
}

function PreviewBody({ colors }: { colors: ThemeColors }) {
  const strongPadding = colors.strongBg === "transparent" ? "0" : "2px 4px";

  return (
    <div style={{ color: colors.foreground, marginBottom: "8px" }}>
      <Trans
        i18nKey="settings.preview.body"
        ns="common"
        components={{
          bold: (
            <span
              style={{
                color: colors.strongColor,
                fontWeight: 600,
                backgroundColor: colors.strongBg,
                padding: strongPadding,
                borderRadius: "3px",
                margin: "0 1px"
              }}
            />
          ),
          link: <span style={{ color: colors.linkColor, fontWeight: 500 }} />
        }}
      />
    </div>
  );
}

function PreviewBlockquote({ colors }: { colors: ThemeColors }) {
  const { t } = useTranslation("common");

  return (
    <div
      style={{
        borderLeft: `3px solid ${colors.blockquoteBorder}`,
        backgroundColor: colors.blockquoteBg,
        color: colors.quoteColor,
        padding: "6px 10px",
        borderRadius: "0 4px 4px 0",
        marginBottom: "10px",
        fontStyle: "italic"
      }}
    >
      {t("settings.preview.quote")}
    </div>
  );
}

/** 列表项的 Trans 组件映射 */
function listItemComponents(colors: ThemeColors) {
  return {
    em: <span style={{ color: colors.emphasisColor, fontStyle: "italic" }} />,
    code: (
      <code
        style={{
          color: colors.codeColor,
          backgroundColor: colors.codeBg,
          padding: "1px 4px",
          borderRadius: "3px",
          fontSize: "10px"
        }}
      />
    )
  };
}

function PreviewList({ colors }: { colors: ThemeColors }) {
  const components = listItemComponents(colors);
  const listKeys = ["settings.preview.list1", "settings.preview.list2"] as const;

  return (
    <div style={{ color: colors.foreground, marginBottom: "10px", paddingLeft: "6px" }}>
      {listKeys.map((key, i) => (
        <div key={key} style={{ display: "flex", gap: "6px", marginBottom: i === 0 ? "2px" : 0 }}>
          <span style={{ color: colors.listMarker }}>•</span>
          <span>
            <Trans i18nKey={key} ns="common" components={components} />
          </span>
        </div>
      ))}
    </div>
  );
}

function PreviewCodeBlock({ colors }: { colors: ThemeColors }) {
  const { t } = useTranslation("common");

  return (
    <div
      style={{
        backgroundColor: colors.codeBlockBg,
        borderRadius: "6px",
        padding: "8px 10px",
        fontSize: "10px",
        color: colors.codeBlockColor,
        fontFamily: '"SF Mono", Monaco, Consolas, monospace',
        border: `1px solid ${colors.codeBlockBorder}`,
        marginBottom: "10px",
        lineHeight: "1.6"
      }}
    >
      <div>
        <span style={{ color: colors.tagColor }}>const</span> <span style={{ color: colors.foreground }}>app</span>{" "}
        <span style={{ color: colors.mutedForeground }}>=</span>{" "}
        <span style={{ color: colors.codeColor }}>{t("settings.preview.codeValue")}</span>
      </div>
    </div>
  );
}

function PreviewTable({ colors }: { colors: ThemeColors }) {
  const { t } = useTranslation("common");

  return (
    <div
      style={{
        borderRadius: "4px",
        overflow: "hidden",
        border: `1px solid ${colors.border}`,
        fontSize: "10px"
      }}
    >
      <div
        style={{
          display: "flex",
          backgroundColor: colors.tableTh,
          fontWeight: 600,
          color: colors.tableThColor
        }}
      >
        <div style={{ flex: 1, padding: "4px 8px", borderRight: `1px solid ${colors.border}` }}>
          {t("settings.preview.tableFeature")}
        </div>
        <div style={{ flex: 1, padding: "4px 8px" }}>{t("settings.preview.tableFormat")}</div>
      </div>
      <div
        style={{
          display: "flex",
          color: colors.foreground,
          borderTop: `1px solid ${colors.border}`
        }}
      >
        <div style={{ flex: 1, padding: "4px 8px", borderRight: `1px solid ${colors.border}` }}>
          {t("settings.preview.tableExport")}
        </div>
        <div style={{ flex: 1, padding: "4px 8px" }}>{t("settings.preview.tableExportFormats")}</div>
      </div>
    </div>
  );
}

/* ---------- 导出主题预览卡片 ---------- */
const ExportThemePreview = memo(function ExportThemePreview({ colors }: { colors: ThemeColors }) {
  return (
    <div
      className="overflow-hidden rounded-xl text-left"
      style={{
        backgroundColor: colors.background,
        border: `1px solid ${colors.border}`,
        boxShadow: "0 2px 12px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.02)"
      }}
    >
      <ColorPaletteStrip colors={colors} />

      <div className="px-5 py-4" style={{ fontSize: "11.5px", lineHeight: "1.7" }}>
        <PreviewHeading colors={colors} />
        <PreviewBody colors={colors} />
        <PreviewBlockquote colors={colors} />
        <PreviewList colors={colors} />
        <PreviewCodeBlock colors={colors} />
        <div style={{ borderTop: `1.5px solid ${colors.hrColor}`, margin: "10px 0" }} />
        <PreviewTable colors={colors} />
      </div>
    </div>
  );
});

/* ---------- 导出 Tab ---------- */
export function ExportTab() {
  const { t } = useTranslation("common");
  const exportThemeId = useExportThemeStore((state) => state.exportThemeId);
  const colors = useMemo(() => getExportThemeColors(exportThemeId), [exportThemeId]);

  return (
    <div>
      {/* 主题选择 */}
      <div className="divide-border divide-y">
        <SettingRow label={t("settings.exportTheme")} description={t("settings.exportThemeDesc")}>
          <ExportThemeSelect />
        </SettingRow>
      </div>

      {/* 预览 */}
      <div className="mt-6">
        <div className="text-muted-foreground mb-3 text-xs font-medium">{t("settings.exportPreview")}</div>
        <ExportThemePreview colors={colors} />
      </div>
    </div>
  );
}
