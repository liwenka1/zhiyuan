import type { ExportThemePreset } from "../theme-colors";
import { buildThemeColors } from "../theme-colors";

export const defaultTheme = {
  id: "default",
  colors: buildThemeColors({
    background: "#ffffff",
    foreground: "#3a3a3a",
    muted: "#f5f5f5",
    mutedForeground: "#888888",
    border: "#e0e0e0",
    headingColor: "#2c2c2c",
    linkColor: "#576b95",
    listMarker: "#2c2c2c",
    strongColor: "#2c2c2c",
    emphasisColor: "#666666",
    codeColor: "#d14",
    codeBg: "#f5f5f5",
    quoteColor: "#666666",
    hrColor: "#e0e0e0",
    tagColor: "#22863a",
    metaColor: "#888888",
    markBg: "#fff3cd",
    codeBlockBg: "#f6f8fa"
  })
} satisfies ExportThemePreset;
