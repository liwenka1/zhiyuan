/**
 * Markdown HTML 安全过滤配置
 * 使用 rehype-sanitize 防止 XSS 攻击，同时保留必要的 HTML 功能
 */

import { defaultSchema } from "rehype-sanitize";
import type { Options } from "rehype-sanitize";

/**
 * 自定义安全配置
 * 基于 defaultSchema，扩展支持音视频、样式等功能
 */
export const markdownSanitizeSchema: Options = {
  ...defaultSchema,

  // 允许的 HTML 标签
  tagNames: [
    ...(defaultSchema.tagNames || []),
    // 媒体标签
    "audio",
    "video",
    "source",
    // 布局标签
    "div",
    "span",
    "figure",
    "figcaption",
    "button"
  ],

  // 允许的属性
  attributes: {
    ...defaultSchema.attributes,

    // 全局属性
    "*": [...(defaultSchema.attributes?.["*"] || []), "className", "class", "id"],

    // 布局元素
    div: ["align", "style"],
    span: ["style"],
    pre: ["style"],
    code: ["style"],
    button: ["type", "aria-label", "data-code-copy-button"],

    // 图片
    img: ["src", "alt", "title", "width", "height", "loading", "align", "style"],

    // 链接
    a: ["href", "title", "target", "rel"],

    // 音频
    audio: ["src", "controls", "autoplay", "loop", "style"],

    // 视频
    video: ["src", "controls", "autoplay", "loop", "width", "height", "poster", "style"],

    // 媒体源
    source: ["src", "type"],

    // 表格
    table: ["align"],
    td: ["align", "colspan", "rowspan"],
    th: ["align", "colspan", "rowspan"]
  },

  // 协议白名单
  protocols: {
    ...defaultSchema.protocols,
    // 显式添加 local-resource:// 协议支持
    // 这是我们的自定义协议，用于加载本地文件
    href: [...(defaultSchema.protocols?.href || []), "local-resource"],
    src: [...(defaultSchema.protocols?.src || []), "local-resource"]
  },

  // 不添加 clobber 前缀（保持 id 原样）
  clobberPrefix: ""
};
