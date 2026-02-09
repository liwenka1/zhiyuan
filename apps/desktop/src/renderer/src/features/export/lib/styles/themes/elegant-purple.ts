import type { ExportThemePreset } from "../theme-colors";
import { buildThemeColors } from "../theme-colors";

export const elegantPurpleTheme = {
  id: "elegant-purple",
  colors: buildThemeColors({
    background: "#faf8ff",
    foreground: "#2e1f4d",
    muted: "#f3edff",
    mutedForeground: "#7c6b9a",
    border: "#d4bfff",
    headingColor: "#2e1f4d",
    linkColor: "#7c3aed",
    listMarker: "#2e1f4d",
    strongColor: "#2e1f4d",
    emphasisColor: "#5b4a78",
    codeColor: "#a21caf",
    codeBg: "#f3edff",
    quoteColor: "#5b4a78",
    hrColor: "#d4bfff",
    tagColor: "#059669",
    metaColor: "#7c6b9a",
    markBg: "#fef3c7",
    codeBlockBg: "#f5f0ff",
    // 语义色覆盖
    h1Decoration: "#7c3aed",
    h2Decoration: "#7c3aed",
    strongBg: "rgba(124, 58, 237, 0.08)",
    blockquoteBorder: "#7c3aed"
  })
} satisfies ExportThemePreset;
