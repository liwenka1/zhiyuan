/**
 * 微信公众号 HTML 生成工具
 * 用于生成适配微信公众号编辑器的 HTML 内容
 */

/**
 * 获取微信公众号适配的主题颜色
 * 微信公众号编辑器只支持移动端，通常使用浅色主题
 */
function getWechatThemeColors() {
  return {
    background: "#ffffff",
    foreground: "#3a3a3a",
    mutedForeground: "#888888",
    border: "#e0e0e0",
    previewTitle: "#2c2c2c",
    previewLink: "#576b95", // 微信链接蓝色
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
    muted: "#f5f5f5",
    previewCodeBg: "#f6f8fa"
  };
}

/**
 * 生成微信公众号适配的 HTML 样式
 * 针对移动端阅读优化，使用更大的字号和行距
 */
function generateWechatHTMLStyles(): string {
  const colors = getWechatThemeColors();

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
  `;
}

/**
 * 生成适配微信公众号的 HTML 文档
 * 所有样式将被内联到 HTML 标签中
 * @param title 笔记标题
 * @param htmlContent HTML 内容
 */
export function generateWechatHTMLDocument(title: string, htmlContent: string): string {
  const styles = generateWechatHTMLStyles();

  // 生成完整的 HTML 文档（带 style 标签，后续会被内联化）
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
${styles}
  </style>
</head>
<body>
${htmlContent}
</body>
</html>`;
}

/**
 * 将 Markdown 内容转换为微信公众号格式的 HTML
 * 在渲染进程中直接处理，不需要通过 IPC
 */
export { markdownToHTML as markdownToWechatHTML } from "./markdown-processor";
