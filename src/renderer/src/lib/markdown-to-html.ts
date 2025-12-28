/**
 * Markdown 转 HTML 工具函数
 * 用于导出功能，生成带样式的完整 HTML 文档
 */

/**
 * 获取主题颜色变量
 * @param isDark 是否为深色主题
 */
function getThemeColors(isDark: boolean) {
  if (isDark) {
    // 深色主题 - 松烟墨池
    return {
      background: "hsl(220, 16%, 13%)",
      foreground: "hsl(40, 12%, 89%)",
      mutedForeground: "hsl(0, 0%, 58%)",
      border: "hsl(220, 12%, 24%)",
      previewTitle: "hsl(200, 65%, 68%)",
      previewLink: "hsl(170, 45%, 58%)",
      previewList: "hsl(40, 12%, 89%)",
      editorStrong: "hsl(40, 12%, 89%)",
      editorEmphasis: "hsl(40, 8%, 72%)",
      editorCode: "hsl(280, 50%, 70%)",
      editorCodeBg: "hsl(220, 18%, 17%)",
      editorQuote: "hsl(0, 0%, 62%)",
      editorHr: "hsl(220, 10%, 32%)",
      editorTag: "hsl(155, 45%, 58%)",
      editorMeta: "hsl(0, 0%, 58%)",
      editorMarkBg: "hsl(45, 80%, 45%)",
      muted: "hsl(220, 14%, 19%)",
      previewCodeBg: "hsl(220, 18%, 17%)"
    };
  } else {
    // 浅色主题 - 春日宣纸
    return {
      background: "hsl(40, 20%, 98%)",
      foreground: "hsl(220, 15%, 26%)",
      mutedForeground: "hsl(0, 0%, 48%)",
      border: "hsl(40, 10%, 88%)",
      previewTitle: "hsl(210, 48%, 42%)",
      previewLink: "hsl(195, 58%, 45%)",
      previewList: "hsl(220, 15%, 26%)",
      editorStrong: "hsl(220, 15%, 26%)",
      editorEmphasis: "hsl(220, 12%, 38%)",
      editorCode: "hsl(280, 55%, 45%)",
      editorCodeBg: "hsl(150, 18%, 94%)",
      editorQuote: "hsl(0, 0%, 48%)",
      editorHr: "hsl(40, 8%, 82%)",
      editorTag: "hsl(155, 50%, 40%)",
      editorMeta: "hsl(0, 0%, 54%)",
      editorMarkBg: "hsl(45, 90%, 68%)",
      muted: "hsl(40, 15%, 94%)",
      previewCodeBg: "hsl(150, 18%, 94%)"
    };
  }
}

/**
 * 生成 HTML 样式
 * @param isDark 是否为深色主题
 */
function generateHTMLStyles(isDark: boolean): string {
  const colors = getThemeColors(isDark);

  return `
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    html {
      font-family: "LXGW WenKai", "PingFang SC", "Microsoft YaHei", -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
      font-size: 16px;
      line-height: 1.5;
      letter-spacing: 0.3px;
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

    /* Tailwind Typography Prose 样式 */
    article {
      font-size: 1rem;
      line-height: 1.75;
    }

    article > * + * {
      margin-top: 1.25em;
    }

    /* 标题 */
    article h1 {
      font-size: 2.25em;
      font-weight: 800;
      line-height: 1.1111111;
      color: ${colors.previewTitle};
      margin-top: 0;
      margin-bottom: 0.8888889em;
    }

    article h2 {
      font-size: 1.5em;
      font-weight: 700;
      line-height: 1.3333333;
      color: ${colors.previewTitle};
      margin-top: 2em;
      margin-bottom: 1em;
    }

    article h3 {
      font-size: 1.25em;
      font-weight: 600;
      line-height: 1.6;
      color: ${colors.previewTitle};
      margin-top: 1.6em;
      margin-bottom: 0.6em;
    }

    article h4 {
      font-weight: 600;
      line-height: 1.5;
      color: ${colors.previewTitle};
      margin-top: 1.5em;
      margin-bottom: 0.5em;
    }

    article h5, article h6 {
      font-weight: 600;
      color: ${colors.previewTitle};
    }

    /* 段落 */
    article p {
      margin-top: 1.25em;
      margin-bottom: 1.25em;
    }

    /* 链接 */
    article a {
      color: ${colors.previewLink};
      text-decoration: underline;
      font-weight: 500;
    }

    article a:hover {
      opacity: 0.8;
    }

    /* 加粗 */
    article strong {
      color: ${colors.editorStrong};
      font-weight: 600;
    }

    /* 斜体 */
    article em {
      color: ${colors.editorEmphasis};
      font-style: italic;
    }

    /* 行内代码 */
    article code {
      color: ${colors.editorCode};
      background-color: ${colors.editorCodeBg};
      font-family: "JetBrains Mono", "SF Mono", "Monaco", "Consolas", "Courier New", monospace;
      font-size: 0.875em;
      padding: 0.2em 0.4em;
      border-radius: 0.25rem;
      font-weight: 500;
    }

    /* 代码块 */
    article pre {
      background-color: ${colors.previewCodeBg};
      overflow-x: auto;
      font-size: 0.875em;
      line-height: 1.7142857;
      margin-top: 1.7142857em;
      margin-bottom: 1.7142857em;
      border-radius: 0.375rem;
      padding: 0.8571429em 1.1428571em;
    }

    article pre code {
      background-color: transparent;
      border-width: 0;
      border-radius: 0;
      padding: 0;
      font-weight: inherit;
      color: ${colors.foreground};
      font-size: inherit;
      font-family: "JetBrains Mono", "SF Mono", "Monaco", "Consolas", "Courier New", monospace;
      line-height: inherit;
    }

    /* 引用 */
    article blockquote {
      font-weight: 500;
      font-style: italic;
      color: ${colors.editorQuote};
      border-left-width: 0.25rem;
      border-left-color: ${colors.border};
      quotes: "\\201C""\\201D""\\2018""\\2019";
      margin-top: 1.6em;
      margin-bottom: 1.6em;
      padding-left: 1em;
    }

    /* 列表 */
    article ul, article ol {
      margin-top: 1.25em;
      margin-bottom: 1.25em;
      padding-left: 1.625em;
    }

    article li {
      margin-top: 0.5em;
      margin-bottom: 0.5em;
    }

    article ul > li {
      padding-left: 0.375em;
    }

    article ol > li {
      padding-left: 0.375em;
    }

    article ul > li::marker {
      color: ${colors.previewList};
    }

    article ol > li::marker {
      color: ${colors.previewList};
      font-weight: 400;
    }

    /* 嵌套列表 */
    article ul ul, article ul ol, article ol ul, article ol ol {
      margin-top: 0.75em;
      margin-bottom: 0.75em;
    }

    /* 水平线 */
    article hr {
      border-color: ${colors.editorHr};
      border-top-width: 1px;
      margin-top: 3em;
      margin-bottom: 3em;
    }

    /* 表格 */
    article table {
      width: 100%;
      table-layout: auto;
      text-align: left;
      margin-top: 2em;
      margin-bottom: 2em;
      font-size: 0.875em;
      line-height: 1.7142857;
      border-collapse: collapse;
    }

    article thead {
      border-bottom-width: 1px;
      border-bottom-color: ${colors.border};
    }

    article thead th {
      color: ${colors.foreground};
      font-weight: 600;
      vertical-align: bottom;
      padding-right: 0.5714286em;
      padding-bottom: 0.5714286em;
      padding-left: 0.5714286em;
    }

    article tbody tr {
      border-bottom-width: 1px;
      border-bottom-color: ${colors.border};
    }

    article tbody td {
      vertical-align: baseline;
      padding: 0.5714286em;
    }

    /* 图片 */
    article img {
      max-width: 100%;
      height: auto;
      margin-top: 2em;
      margin-bottom: 2em;
    }

    /* kbd */
    article kbd {
      font-family: "JetBrains Mono", "SF Mono", "Monaco", "Consolas", "Courier New", monospace;
      color: ${colors.editorTag};
      background-color: ${colors.muted};
      border: 1px solid ${colors.border};
      border-radius: 0.25rem;
      padding: 0.1em 0.4em;
      font-size: 0.875em;
    }

    /* 上下标 */
    article sup, article sub {
      color: ${colors.editorMeta};
      font-size: 0.75em;
    }

    /* mark */
    article mark {
      background-color: ${colors.editorMarkBg};
      padding: 0.1em 0.2em;
    }

    /* 任务列表 */
    article input[type="checkbox"] {
      margin-right: 0.5em;
    }
  `;
}

/**
 * 生成完整的 HTML 文档
 * @param title 笔记标题
 * @param htmlContent HTML 内容
 * @param isDark 是否为深色主题
 */
export function generateHTMLDocument(title: string, htmlContent: string, isDark: boolean): string {
  const styles = generateHTMLStyles(isDark);

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="generator" content="xx-note">
  <title>${title}</title>
  <style>
${styles}
  </style>
</head>
<body>
  <article>
${htmlContent}
  </article>
</body>
</html>`;
}

/**
 * 将 Markdown 内容转换为 HTML
 * 在渲染进程中直接处理，不需要通过 IPC
 */
export { markdownToHTML } from "./markdown-processor";
