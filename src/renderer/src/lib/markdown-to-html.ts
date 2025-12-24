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
    return {
      background: "hsl(210, 14%, 16%)",
      foreground: "hsl(0, 0%, 95%)",
      mutedForeground: "hsl(0, 0%, 60%)",
      border: "hsl(210, 14%, 22%)",
      previewTitle: "hsl(0, 0%, 90%)",
      previewLink: "hsl(206, 100%, 64%)",
      previewList: "hsl(0, 0%, 90%)",
      editorStrong: "hsl(0, 0%, 95%)",
      editorEmphasis: "hsl(0, 0%, 75%)",
      editorCode: "hsl(280, 100%, 75%)",
      editorCodeBg: "hsl(210, 14%, 22%)",
      editorQuote: "hsl(0, 0%, 65%)",
      editorHr: "hsl(0, 0%, 35%)",
      editorTag: "hsl(155, 60%, 60%)",
      editorMeta: "hsl(0, 0%, 60%)",
      editorMarkBg: "hsl(45, 100%, 40%)",
      muted: "hsl(210, 14%, 22%)",
      previewCodeBg: "hsl(210, 14%, 22%)"
    };
  } else {
    return {
      background: "hsl(0, 0%, 100%)",
      foreground: "hsl(0, 0%, 9%)",
      mutedForeground: "hsl(0, 0%, 45%)",
      border: "hsl(0, 0%, 90%)",
      previewTitle: "hsl(0, 0%, 26%)",
      previewLink: "hsl(207, 100%, 44%)",
      previewList: "hsl(0, 0%, 26%)",
      editorStrong: "hsl(0, 0%, 9%)",
      editorEmphasis: "hsl(0, 0%, 25%)",
      editorCode: "hsl(280, 100%, 40%)",
      editorCodeBg: "hsl(0, 0%, 96%)",
      editorQuote: "hsl(0, 0%, 45%)",
      editorHr: "hsl(0, 0%, 80%)",
      editorTag: "hsl(155, 60%, 35%)",
      editorMeta: "hsl(0, 0%, 55%)",
      editorMarkBg: "hsl(45, 100%, 70%)",
      muted: "hsl(0, 0%, 96%)",
      previewCodeBg: "hsl(0, 0%, 96%)"
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
 * 将 Markdown 内容转换为 HTML（需要在主进程中实现真正的转换）
 * 这个函数只是一个接口定义，实际转换在主进程完成
 */
export async function markdownToHTML(markdown: string): Promise<string> {
  // 调用主进程的 API 进行转换
  return await window.api.export.markdownToHTML(markdown);
}
