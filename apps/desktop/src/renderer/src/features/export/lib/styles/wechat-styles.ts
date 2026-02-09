/**
 * 微信公众号样式生成器
 * 针对移动端阅读优化，使用更大的字号和行距
 */

import type { ThemeColors } from "./theme-colors";

/**
 * 生成微信公众号专用样式
 * 针对移动端阅读优化，使用更大的字号和行距
 */
export function generateWechatStyles(colors: ThemeColors): string {
  const strongPadding = colors.strongBg === "transparent" ? "0" : "2px 4px";

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
      color: ${colors.h1Color};
      margin: 1.2em 0 0.8em;
      padding-bottom: 0.3em;
      border-bottom: 2px solid ${colors.h1Decoration};
    }

    h1:first-child {
      margin-top: 0;
    }

    h2 {
      font-size: 1.5em;
      font-weight: 600;
      line-height: 1.4;
      color: ${colors.h2Color};
      margin: 1.5em 0 0.8em;
      padding-left: 12px;
      border-left: 4px solid ${colors.h2Decoration};
    }

    h3 {
      font-size: 1.3em;
      font-weight: 600;
      line-height: 1.5;
      color: ${colors.headingColor};
      margin: 1.3em 0 0.6em;
    }

    h4 {
      font-size: 1.1em;
      font-weight: 600;
      line-height: 1.5;
      color: ${colors.headingColor};
      margin: 1.2em 0 0.5em;
    }

    h5, h6 {
      font-size: 1em;
      font-weight: 600;
      color: ${colors.headingColor};
      margin: 1em 0 0.5em;
    }

    /* 段落 */
    p {
      margin: 1em 0;
      text-align: justify;
    }

    /* 链接 */
    a {
      color: ${colors.linkColor};
      text-decoration: none;
      font-weight: 500;
      word-wrap: break-word;
    }

    a:hover {
      text-decoration: underline;
    }

    /* 加粗 */
    strong {
      color: ${colors.strongColor};
      font-weight: 600;
      background-color: ${colors.strongBg};
      padding: ${strongPadding};
      border-radius: 3px;
    }

    /* 斜体 */
    em {
      color: ${colors.emphasisColor};
      font-style: italic;
    }

    /* 行内代码 */
    code {
      color: ${colors.codeColor};
      background-color: ${colors.codeBg};
      font-family: "SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace;
      font-size: 0.9em;
      padding: 2px 6px;
      border-radius: 3px;
      margin: 0 2px;
      word-wrap: break-word;
    }

    /* 代码块 */
    pre {
      background-color: ${colors.codeBlockBg};
      overflow-x: auto;
      font-size: 0.9em;
      line-height: 1.6;
      margin: 1.2em 0;
      border-radius: 6px;
      padding: 12px 16px;
      border: 1px solid ${colors.codeBlockBorder};
    }

    pre code {
      background-color: transparent;
      border-radius: 0;
      padding: 0;
      margin: 0;
      color: ${colors.codeBlockColor};
      font-size: inherit;
      font-family: "SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace;
      line-height: inherit;
    }

    /* 引用 */
    blockquote {
      font-weight: 400;
      font-style: normal;
      color: ${colors.quoteColor};
      border-left: 4px solid ${colors.blockquoteBorder};
      background-color: ${colors.blockquoteBg};
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
      border-top: 2px solid ${colors.hrColor};
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
      background-color: ${colors.tableTh};
    }

    thead th {
      color: ${colors.tableThColor};
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
      color: ${colors.linkColor};
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
