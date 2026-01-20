/**
 * 导出样式生成器
 * 基于 CSS 变量生成与预览一致的样式，确保导出和预览效果统一
 */

/**
 * 字体文件配置
 */
export const FONT_FILES = {
  lxgwWenKai: "LXGWWenKaiMono-Medium.ttf",
  jetBrainsMono: "JetBrainsMono-Regular.ttf"
} as const;

/**
 * 生成 @font-face 声明
 * @param fontsPath 字体文件的相对路径前缀（如 "./fonts" 或 "./assets"）
 */
export function generateFontFaces(fontsPath: string): string {
  return `
    @font-face {
      font-family: "LXGW WenKai";
      src: url("${fontsPath}/${FONT_FILES.lxgwWenKai}") format("truetype");
      font-weight: normal;
      font-style: normal;
      font-display: swap;
    }

    @font-face {
      font-family: "JetBrains Mono";
      src: url("${fontsPath}/${FONT_FILES.jetBrainsMono}") format("truetype");
      font-weight: normal;
      font-style: normal;
      font-display: swap;
      font-feature-settings: "liga" 1, "calt" 1;
    }
  `;
}

/**
 * 生成内嵌 base64 字体的 @font-face 声明
 * @param lxgwBase64 霞鹜文楷字体的 base64 编码
 * @param jetBrainsBase64 JetBrains Mono 字体的 base64 编码
 */
export function generateEmbeddedFontFaces(lxgwBase64: string, jetBrainsBase64: string): string {
  return `
    @font-face {
      font-family: "LXGW WenKai";
      src: url(data:font/truetype;base64,${lxgwBase64}) format("truetype");
      font-weight: normal;
      font-style: normal;
    }

    @font-face {
      font-family: "JetBrains Mono";
      src: url(data:font/truetype;base64,${jetBrainsBase64}) format("truetype");
      font-weight: normal;
      font-style: normal;
      font-feature-settings: "liga" 1, "calt" 1;
    }
  `;
}

/**
 * 主题颜色配置
 */
interface ThemeColors {
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

/**
 * 生成 Tailwind Typography prose 样式
 * 与预览组件使用的 prose 类保持一致
 */
export function generateProseStyles(colors: ThemeColors): string {
  return `
    /* 基础重置 */
    *, *::before, *::after {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    html {
      font-family: "LXGW WenKai", "PingFang SC", "Microsoft YaHei", -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
      font-size: 16px;
      line-height: 1.5;
      letter-spacing: 0.5px;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    body {
      background-color: ${colors.background};
      color: ${colors.foreground};
      padding: 2rem;
      max-width: 900px;
      margin: 0 auto;
    }

    /* Tailwind Typography prose 样式 */
    .prose {
      font-size: 1rem;
      line-height: 1.75;
      color: ${colors.foreground};
    }

    .prose > * + * {
      margin-top: 1.25em;
    }

    /* 标题 - 与 prose 类一致 */
    .prose h1 {
      font-size: 2.25em;
      font-weight: 800;
      line-height: 1.1111111;
      color: ${colors.previewTitle};
      margin-top: 0;
      margin-bottom: 0.8888889em;
    }

    .prose h2 {
      font-size: 1.5em;
      font-weight: 700;
      line-height: 1.3333333;
      color: ${colors.previewTitle};
      margin-top: 2em;
      margin-bottom: 1em;
    }

    .prose h3 {
      font-size: 1.25em;
      font-weight: 600;
      line-height: 1.6;
      color: ${colors.previewTitle};
      margin-top: 1.6em;
      margin-bottom: 0.6em;
    }

    .prose h4 {
      font-weight: 600;
      line-height: 1.5;
      color: ${colors.previewTitle};
      margin-top: 1.5em;
      margin-bottom: 0.5em;
    }

    .prose h5, .prose h6 {
      font-weight: 600;
      color: ${colors.previewTitle};
    }

    /* 段落 */
    .prose p {
      margin-top: 1.25em;
      margin-bottom: 1.25em;
    }

    /* 链接 */
    .prose a {
      color: ${colors.previewLink};
      text-decoration: underline;
      font-weight: 500;
    }

    .prose a:hover {
      opacity: 0.8;
    }

    /* 加粗 */
    .prose strong {
      color: ${colors.editorStrong};
      font-weight: 600;
    }

    /* 斜体 */
    .prose em {
      color: ${colors.editorEmphasis};
      font-style: italic;
    }

    /* 行内代码 */
    .prose code {
      color: ${colors.editorCode};
      background-color: ${colors.editorCodeBg};
      font-family: "JetBrains Mono", "SF Mono", Monaco, Consolas, "Courier New", monospace;
      font-size: 0.875em;
      padding: 0.2em 0.4em;
      border-radius: 0.25rem;
      font-weight: 500;
    }

    /* 代码块 */
    .prose pre {
      background-color: ${colors.previewCodeBg};
      overflow-x: auto;
      font-size: 0.875em;
      line-height: 1.7142857;
      margin-top: 1.7142857em;
      margin-bottom: 1.7142857em;
      border-radius: 0.375rem;
      padding: 0.8571429em 1.1428571em;
    }

    .prose pre code {
      background-color: transparent;
      border-width: 0;
      border-radius: 0;
      padding: 0;
      font-weight: inherit;
      color: ${colors.foreground};
      font-size: inherit;
      font-family: "JetBrains Mono", "SF Mono", Monaco, Consolas, "Courier New", monospace;
      line-height: inherit;
    }

    /* 引用 */
    .prose blockquote {
      font-weight: 500;
      font-style: italic;
      color: ${colors.editorQuote};
      border-left-width: 0.25rem;
      border-left-style: solid;
      border-left-color: ${colors.border};
      margin-top: 1.6em;
      margin-bottom: 1.6em;
      padding-left: 1em;
    }

    /* 列表 */
    .prose ul, .prose ol {
      margin-top: 1.25em;
      margin-bottom: 1.25em;
      padding-left: 1.625em;
    }

    .prose li {
      margin-top: 0.5em;
      margin-bottom: 0.5em;
    }

    .prose ul > li {
      padding-left: 0.375em;
      list-style-type: disc;
    }

    .prose ol > li {
      padding-left: 0.375em;
      list-style-type: decimal;
    }

    .prose ul > li::marker,
    .prose ol > li::marker {
      color: ${colors.previewList};
    }

    /* 嵌套列表 */
    .prose ul ul, .prose ul ol, .prose ol ul, .prose ol ol {
      margin-top: 0.75em;
      margin-bottom: 0.75em;
    }

    /* 水平线 */
    .prose hr {
      border: 0;
      border-top: 1px solid ${colors.editorHr};
      margin-top: 3em;
      margin-bottom: 3em;
    }

    /* 表格 */
    .prose table {
      width: 100%;
      table-layout: auto;
      text-align: left;
      margin-top: 2em;
      margin-bottom: 2em;
      font-size: 0.875em;
      line-height: 1.7142857;
      border-collapse: collapse;
    }

    .prose thead {
      border-bottom: 1px solid ${colors.border};
    }

    .prose thead th {
      color: ${colors.foreground};
      font-weight: 600;
      vertical-align: bottom;
      padding: 0 0.5714286em 0.5714286em 0.5714286em;
    }

    .prose tbody tr {
      border-bottom: 1px solid ${colors.border};
    }

    .prose tbody tr:last-child {
      border-bottom: none;
    }

    .prose tbody td {
      vertical-align: baseline;
      padding: 0.5714286em;
    }

    /* 图片 */
    .prose img {
      max-width: 100%;
      height: auto;
      margin-top: 2em;
      margin-bottom: 2em;
      display: block;
    }

    /* 删除线 */
    .prose del {
      text-decoration: line-through;
      opacity: 0.7;
    }

    /* kbd */
    .prose kbd {
      font-family: "JetBrains Mono", "SF Mono", Monaco, Consolas, "Courier New", monospace;
      color: ${colors.editorTag};
      background-color: ${colors.muted};
      border: 1px solid ${colors.border};
      border-radius: 0.25rem;
      padding: 0.1em 0.4em;
      font-size: 0.875em;
    }

    /* 上下标 */
    .prose sup, .prose sub {
      color: ${colors.editorMeta};
      font-size: 0.75em;
    }

    /* mark */
    .prose mark {
      background-color: ${colors.editorMarkBg};
      padding: 0.1em 0.2em;
    }

    /* 任务列表 */
    .prose input[type="checkbox"] {
      margin-right: 0.5em;
      vertical-align: middle;
    }
  `;
}

/**
 * 生成微信公众号专用样式
 * 针对移动端阅读优化，使用更大的字号和行距
 */
export function generateWechatStyles(colors: ThemeColors): string {
  return `
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      background-color: ${colors.background};
      color: ${colors.foreground};
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Helvetica, Arial, sans-serif;
      font-size: 16px;
      line-height: 1.75;
      letter-spacing: 0.5px;
      padding: 16px 0;
      word-wrap: break-word;
    }

    /* 标题 */
    h1 {
      font-size: 1.75em;
      font-weight: 700;
      line-height: 1.3;
      color: ${colors.previewTitle};
      margin: 1.2em 0 0.8em;
      padding-bottom: 0.3em;
      border-bottom: 2px solid ${colors.border};
    }

    h1:first-child {
      margin-top: 0;
    }

    h2 {
      font-size: 1.5em;
      font-weight: 600;
      line-height: 1.4;
      color: ${colors.previewTitle};
      margin: 1.5em 0 0.8em;
      padding-bottom: 0.2em;
      border-bottom: 1px solid ${colors.border};
    }

    h3 {
      font-size: 1.3em;
      font-weight: 600;
      line-height: 1.5;
      color: ${colors.previewTitle};
      margin: 1.3em 0 0.6em;
    }

    h4 {
      font-size: 1.1em;
      font-weight: 600;
      line-height: 1.5;
      color: ${colors.previewTitle};
      margin: 1.2em 0 0.5em;
    }

    h5, h6 {
      font-size: 1em;
      font-weight: 600;
      color: ${colors.previewTitle};
      margin: 1em 0 0.5em;
    }

    /* 段落 */
    p {
      margin: 1em 0;
      text-align: justify;
    }

    /* 链接 */
    a {
      color: ${colors.previewLink};
      text-decoration: none;
      font-weight: 500;
      word-wrap: break-word;
    }

    a:hover {
      text-decoration: underline;
    }

    /* 加粗 */
    strong {
      color: ${colors.editorStrong};
      font-weight: 600;
    }

    /* 斜体 */
    em {
      color: ${colors.editorEmphasis};
      font-style: italic;
    }

    /* 行内代码 */
    code {
      color: ${colors.editorCode};
      background-color: ${colors.editorCodeBg};
      font-family: "SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace;
      font-size: 0.9em;
      padding: 2px 6px;
      border-radius: 3px;
      margin: 0 2px;
      word-wrap: break-word;
    }

    /* 代码块 */
    pre {
      background-color: ${colors.previewCodeBg};
      overflow-x: auto;
      font-size: 0.9em;
      line-height: 1.6;
      margin: 1.2em 0;
      border-radius: 6px;
      padding: 12px 16px;
      border: 1px solid ${colors.border};
    }

    pre code {
      background-color: transparent;
      border-radius: 0;
      padding: 0;
      margin: 0;
      color: ${colors.foreground};
      font-size: inherit;
      font-family: "SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace;
      line-height: inherit;
    }

    /* 引用 */
    blockquote {
      font-weight: 400;
      font-style: normal;
      color: ${colors.editorQuote};
      border-left: 4px solid ${colors.border};
      background-color: ${colors.muted};
      margin: 1.2em 0;
      padding: 0.8em 1em;
      border-radius: 0 4px 4px 0;
    }

    blockquote p {
      margin: 0.5em 0;
    }

    blockquote p:first-child {
      margin-top: 0;
    }

    blockquote p:last-child {
      margin-bottom: 0;
    }

    /* 列表 */
    ul, ol {
      margin: 1em 0;
      padding-left: 2em;
    }

    li {
      margin: 0.5em 0;
      line-height: 1.75;
    }

    ul > li {
      list-style-type: disc;
    }

    ol > li {
      list-style-type: decimal;
    }

    /* 嵌套列表 */
    ul ul, ul ol, ol ul, ol ol {
      margin: 0.5em 0;
    }

    /* 水平线 */
    hr {
      border: 0;
      border-top: 2px solid ${colors.editorHr};
      margin: 2em 0;
    }

    /* 表格 */
    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      margin: 1.5em 0;
      font-size: 0.95em;
      line-height: 1.6;
      overflow: auto;
      display: block;
      border: 1px solid ${colors.border};
      border-radius: 4px;
    }

    thead {
      background-color: ${colors.muted};
    }

    thead th {
      color: ${colors.foreground};
      font-weight: 600;
      padding: 12px 16px;
      border-bottom: 2px solid ${colors.border};
      text-align: left;
    }

    tbody tr {
      border-bottom: 1px solid ${colors.border};
    }

    tbody tr:last-child {
      border-bottom: none;
    }

    tbody td {
      padding: 10px 16px;
      vertical-align: top;
    }

    /* 图片 */
    img {
      max-width: 100%;
      height: auto;
      margin: 1.2em 0;
      display: block;
      border-radius: 4px;
    }

    /* 删除线 */
    del {
      text-decoration: line-through;
      opacity: 0.7;
    }

    /* 任务列表 */
    input[type="checkbox"] {
      margin-right: 0.5em;
      vertical-align: middle;
    }

    /* 脚注 */
    sup {
      color: ${colors.previewLink};
    }

    /* Mermaid 图表 */
    .mermaid {
      display: flex;
      justify-content: center;
      margin: 1.5em 0;
    }

    .mermaid svg {
      max-width: 100%;
      height: auto;
    }
  `;
}
