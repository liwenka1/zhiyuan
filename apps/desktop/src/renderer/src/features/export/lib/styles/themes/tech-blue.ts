import type { ExportThemePreset } from "../theme-colors";
import { buildThemeColors } from "../theme-colors";

export const techBlueTheme = {
  id: "tech-blue",
  colors: buildThemeColors({
    background: "#f8faff",
    foreground: "#1e293b",
    muted: "#eef2ff",
    mutedForeground: "#64748b",
    border: "#c7d2fe",
    headingColor: "#1e1b4b",
    linkColor: "#2563eb",
    listMarker: "#1e1b4b",
    strongColor: "#1e1b4b",
    emphasisColor: "#475569",
    codeColor: "#7c3aed",
    codeBg: "#eef2ff",
    quoteColor: "#475569",
    hrColor: "#c7d2fe",
    tagColor: "#059669",
    metaColor: "#64748b",
    markBg: "#fef3c7",
    codeBlockBg: "#f1f5f9",
    // 语义色覆盖
    h1Decoration: "#2563eb",
    h2Decoration: "#2563eb",
    strongBg: "rgba(37, 99, 235, 0.08)",
    blockquoteBorder: "#2563eb"
  })
} satisfies ExportThemePreset;
