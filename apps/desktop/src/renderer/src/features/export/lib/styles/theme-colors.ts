/**
 * 主题颜色配置
 * 管理不同主题（浅色、深色、微信）的颜色方案
 */

/**
 * 主题颜色配置接口
 */
export interface ThemeColors {
  background: string;
  foreground: string;
  muted: string;
  mutedForeground: string;
  border: string;
  previewTitle: string;
  previewLink: string;
  previewList: string;
  editorStrong: string;
  editorEmphasis: string;
  editorCode: string;
  editorCodeBg: string;
  editorQuote: string;
  editorHr: string;
  editorTag: string;
  editorMeta: string;
  editorMarkBg: string;
  previewCodeBg: string;
}

/**
 * CSS 变量映射配置
 * 定义了 ThemeColors 中每个字段对应的 CSS 变量名
 */
const CSS_VAR_MAP = {
  background: "background",
  foreground: "foreground",
  muted: "muted",
  mutedForeground: "muted-foreground",
  border: "border",
  previewTitle: "preview-title",
  previewLink: "preview-link",
  previewList: "preview-list",
  editorStrong: "foreground",
  editorEmphasis: "foreground",
  editorCode: "editor-code",
  editorCodeBg: "accent",
  editorQuote: "editor-quote",
  editorHr: "editor-hr",
  editorTag: "editor-tag",
  editorMeta: "editor-meta",
  editorMarkBg: "editor-mark-bg",
  previewCodeBg: "preview-code-bg"
} as const;

/**
 * 从 DOM 中读取 CSS 变量并生成主题颜色
 * 用于实时获取当前应用的主题颜色
 * @param isDark 是否为深色主题
 */
export function getThemeColorsFromDOM(isDark: boolean = false): ThemeColors {
  const tempDiv = document.createElement("div");
  if (isDark) {
    tempDiv.className = "dark";
  }
  tempDiv.style.display = "none";
  document.body.appendChild(tempDiv);

  const computedStyle = getComputedStyle(tempDiv);
  const colors = {} as ThemeColors;

  for (const [key, varName] of Object.entries(CSS_VAR_MAP)) {
    colors[key as keyof ThemeColors] = computedStyle.getPropertyValue(`--${varName}`).trim();
  }

  document.body.removeChild(tempDiv);
  return colors;
}

/**
 * 微信公众号主题颜色（固定浅色）
 */
const wechatTheme: ThemeColors = {
  background: "#ffffff",
  foreground: "#3a3a3a",
  muted: "#f5f5f5",
  mutedForeground: "#888888",
  border: "#e0e0e0",
  previewTitle: "#2c2c2c",
  previewLink: "#576b95",
  previewList: "#2c2c2c",
  editorStrong: "#2c2c2c",
  editorEmphasis: "#666666",
  editorCode: "#d14",
  editorCodeBg: "#f5f5f5",
  editorQuote: "#666666",
  editorHr: "#e0e0e0",
  editorTag: "#22863a",
  editorMeta: "#888888",
  editorMarkBg: "#fff3cd",
  previewCodeBg: "#f6f8fa"
};

/**
 * 获取主题颜色
 * @param theme 主题类型
 *
 * 注意：对于 light 和 dark 主题，会自动从 DOM 中读取 CSS 变量
 * 这样可以确保导出的颜色与当前应用主题完全一致，无需手动维护
 */
export function getThemeColors(theme: "light" | "dark" | "wechat"): ThemeColors {
  switch (theme) {
    case "dark":
      return getThemeColorsFromDOM(true);
    case "wechat":
      return wechatTheme;
    default:
      return getThemeColorsFromDOM(false);
  }
}
