import type { ThemeColorsInput } from "../theme-colors";
import { buildAccentDecorations } from "../theme-colors";

export interface ExportThemeBaseColors {
  id: string;
  base: ThemeColorsInput;
}

export const EXPORT_THEME_BASE_COLORS: ExportThemeBaseColors[] = [
  {
    id: "default",
    base: {
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
    }
  },
  {
    id: "tech-blue",
    base: {
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
      ...buildAccentDecorations("#2563eb", "rgba(37, 99, 235, 0.08)")
    }
  },
  {
    id: "warm-orange",
    base: {
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
      ...buildAccentDecorations("#ea580c", "rgba(234, 88, 12, 0.08)")
    }
  },
  {
    id: "elegant-purple",
    base: {
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
      ...buildAccentDecorations("#7c3aed", "rgba(124, 58, 237, 0.08)")
    }
  },
  {
    id: "forest-green",
    base: {
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
      ...buildAccentDecorations("#059669", "rgba(5, 150, 105, 0.08)")
    }
  }
];
