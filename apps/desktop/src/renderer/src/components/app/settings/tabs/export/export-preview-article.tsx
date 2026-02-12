import { useTranslation, Trans } from "react-i18next";
import type { ThemeColors } from "@/features/export/lib/styles";

function PreviewHeading({ colors }: { colors: ThemeColors }) {
  const { t } = useTranslation("common");

  return (
    <div
      style={{
        color: colors.h1Color,
        fontWeight: 700,
        fontSize: "17px",
        lineHeight: "1.35",
        borderBottom: `2px solid ${colors.h1Decoration}`,
        paddingBottom: "8px",
        marginBottom: "12px",
        letterSpacing: "-0.01em"
      }}
    >
      {t("settings.preview.appName")}
    </div>
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

function PreviewImage({ colors }: { colors: ThemeColors }) {
  return (
    <img
      alt="preview"
      src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1200' height='675'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop stop-color='%2394a3b8' offset='0'/%3E%3Cstop stop-color='%23cbd5e1' offset='1'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='1200' height='675' fill='url(%23g)'/%3E%3C/svg%3E"
      style={{
        width: "100%",
        height: "96px",
        objectFit: "cover",
        border: `1px solid ${colors.border}`,
        marginBottom: "10px"
      }}
    />
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

export function ExportPreviewArticle({
  colors,
  baseFontSize,
  cardPadding
}: {
  colors: ThemeColors;
  baseFontSize: number;
  cardPadding: number;
}) {
  return (
    <div style={{ fontSize: `${baseFontSize}px`, lineHeight: "1.7", padding: `${cardPadding}px` }}>
      <PreviewHeading colors={colors} />
      <PreviewBody colors={colors} />
      <PreviewImage colors={colors} />
      <PreviewBlockquote colors={colors} />
      <PreviewList colors={colors} />
      <PreviewCodeBlock colors={colors} />
      <div style={{ borderTop: `1.5px solid ${colors.hrColor}`, margin: "10px 0" }} />
      <PreviewTable colors={colors} />
    </div>
  );
}
