import type { ExportThemePreset } from "../theme-colors";
import { buildThemeColors } from "../theme-colors";

export const forestGreenTheme = {
  id: "forest-green",
  colors: buildThemeColors({
    background: "#f5faf7",
    foreground: "#1a3a2a",
    muted: "#e6f4ec",
    mutedForeground: "#5f8a70",
    border: "#a7d5b8",
    headingColor: "#1a3a2a",
    linkColor: "#059669",
    listMarker: "#1a3a2a",
    strongColor: "#1a3a2a",
    emphasisColor: "#3d6b50",
    codeColor: "#0f766e",
    codeBg: "#e6f4ec",
    quoteColor: "#3d6b50",
    hrColor: "#a7d5b8",
    tagColor: "#7c3aed",
    metaColor: "#5f8a70",
    markBg: "#fef3c7",
    codeBlockBg: "#edf7f1",
    // 语义色覆盖
    h1Decoration: "#059669",
    h2Decoration: "#059669",
    strongBg: "rgba(5, 150, 105, 0.08)",
    blockquoteBorder: "#059669"
  })
} satisfies ExportThemePreset;
