/**
 * CSS 内联化工具
 * 使用 juice 将 HTML 中的 CSS 样式内联到标签的 style 属性
 */

import juice from "juice";

/**
 * 将 HTML 中的 CSS 内联化
 */
export function inlineCSS(htmlContent: string): string {
  return juice(htmlContent, {
    removeStyleTags: true,
    preserveMediaQueries: false,
    preserveFontFaces: false
  });
}
