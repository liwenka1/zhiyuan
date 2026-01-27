/**
 * 字体配置
 * 管理导出功能中使用的字体文件和字体声明
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
 * 用于 HTML 导出时引用相对路径的字体文件
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
 * 用于 PDF/图片导出时将字体内嵌到 HTML 中
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
