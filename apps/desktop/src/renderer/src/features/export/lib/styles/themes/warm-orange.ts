import type { ExportThemePreset } from "../theme-colors";
import { buildThemeColors } from "../theme-colors";

export const warmOrangeTheme = {
  id: "warm-orange",
  colors: buildThemeColors({
    background: "#fffaf5",
    foreground: "#3d2c1e",
    muted: "#fef3e2",
    mutedForeground: "#9a7b5b",
    border: "#f5d5b0",
    headingColor: "#3d2c1e",
    linkColor: "#ea580c",
    listMarker: "#3d2c1e",
    strongColor: "#3d2c1e",
    emphasisColor: "#78614e",
    codeColor: "#c2410c",
    codeBg: "#fef3e2",
    quoteColor: "#78614e",
    hrColor: "#f5d5b0",
    tagColor: "#15803d",
    metaColor: "#9a7b5b",
    markBg: "#fef9c3",
    codeBlockBg: "#fef7ee",
    // 语义色覆盖
    h1Decoration: "#ea580c",
    h2Decoration: "#ea580c",
    strongBg: "rgba(234, 88, 12, 0.08)",
    blockquoteBorder: "#ea580c"
  })
} satisfies ExportThemePreset;
