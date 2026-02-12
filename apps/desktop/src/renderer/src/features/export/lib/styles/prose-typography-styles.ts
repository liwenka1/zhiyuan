import type { ThemeColors } from "./theme-colors";

export function generateProseTypographyStyles(colors: ThemeColors): string {
  const strongPadding = colors.strongBg === "transparent" ? "0" : "2px 4px";

  return `
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
      color: ${colors.h1Color};
      margin-top: 0;
      margin-bottom: 0.8888889em;
      padding-bottom: 0.3em;
      border-bottom: 2px solid ${colors.h1Decoration};
    }

    .prose h2 {
      font-size: 1.5em;
      font-weight: 700;
      line-height: 1.3333333;
      color: ${colors.h2Color};
      margin-top: 2em;
      margin-bottom: 1em;
      padding-left: 12px;
      border-left: 4px solid ${colors.h2Decoration};
    }

    .prose h3 {
      font-size: 1.25em;
      font-weight: 600;
      line-height: 1.6;
      color: ${colors.headingColor};
      margin-top: 1.6em;
      margin-bottom: 0.6em;
    }

    .prose h4 {
      font-weight: 600;
      line-height: 1.5;
      color: ${colors.headingColor};
      margin-top: 1.5em;
      margin-bottom: 0.5em;
    }

    .prose h5, .prose h6 {
      font-weight: 600;
      color: ${colors.headingColor};
    }

    /* 段落 */
    .prose p {
      margin-top: 1.25em;
      margin-bottom: 1.25em;
    }

    /* 链接 */
    .prose a {
      color: ${colors.linkColor};
      text-decoration: underline;
      font-weight: 500;
    }

    .prose a:hover {
      opacity: 0.8;
    }

    /* 加粗 */
    .prose strong {
      color: ${colors.strongColor};
      font-weight: 600;
      background-color: ${colors.strongBg};
      padding: ${strongPadding};
      border-radius: 3px;
    }

    /* 斜体 */
    .prose em {
      color: ${colors.emphasisColor};
      font-style: italic;
    }

    /* 行内代码 */
    .prose code {
      color: ${colors.codeColor};
      background-color: ${colors.codeBg};
      font-family: "JetBrains Mono", "SF Mono", Monaco, Consolas, "Courier New", monospace;
      font-size: 0.875em;
      padding: 0.2em 0.4em;
      border-radius: 0.25rem;
      font-weight: 500;
    }

    /* 代码块 */
    .prose pre {
      background-color: ${colors.codeBlockBg};
      overflow-x: auto;
      font-size: 0.875em;
      line-height: 1.7142857;
      margin-top: 1.7142857em;
      margin-bottom: 1.7142857em;
      border-radius: 0.375rem;
      padding: 0.8571429em 1.1428571em;
      border: 1px solid ${colors.codeBlockBorder};
    }

    .prose pre code {
      background-color: transparent;
      border-width: 0;
      border-radius: 0;
      padding: 0;
      font-weight: inherit;
      color: ${colors.codeBlockColor};
      font-size: inherit;
      font-family: "JetBrains Mono", "SF Mono", Monaco, Consolas, "Courier New", monospace;
      line-height: inherit;
    }

    /* 引用 */
    .prose blockquote {
      font-weight: 500;
      font-style: italic;
      color: ${colors.quoteColor};
      border-left-width: 0.25rem;
      border-left-style: solid;
      border-left-color: ${colors.blockquoteBorder};
      background-color: ${colors.blockquoteBg};
      margin-top: 1.6em;
      margin-bottom: 1.6em;
      padding: 0.8em 1em;
      border-radius: 0 4px 4px 0;
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
      color: ${colors.listMarker};
    }

    /* 嵌套列表 */
    .prose ul ul, .prose ul ol, .prose ol ul, .prose ol ol {
      margin-top: 0.75em;
      margin-bottom: 0.75em;
    }

    /* 水平线 */
    .prose hr {
      border: 0;
      border-top: 1px solid ${colors.hrColor};
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
      background-color: ${colors.tableTh};
    }

    .prose thead th {
      color: ${colors.tableThColor};
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
      color: ${colors.tagColor};
      background-color: ${colors.muted};
      border: 1px solid ${colors.border};
      border-radius: 0.25rem;
      padding: 0.1em 0.4em;
      font-size: 0.875em;
    }

    /* 上下标 */
    .prose sup, .prose sub {
      color: ${colors.metaColor};
      font-size: 0.75em;
    }

    /* mark */
    .prose mark {
      background-color: ${colors.markBg};
      padding: 0.1em 0.2em;
    }

    /* 任务列表 */
    .prose input[type="checkbox"] {
      margin-right: 0.5em;
      vertical-align: middle;
    }
  `;
}
