import { syntaxHighlighting, HighlightStyle } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { EditorView } from "@codemirror/view";
import type { Extension } from "@codemirror/state";

/**
 * 创建使用项目 CSS 变量的自定义编辑器主题
 */
export function createCustomTheme(isDark: boolean): Extension {
  const baseTheme = EditorView.theme(
    {
      // 编辑器容器
      "&": {
        height: "auto",
        backgroundColor: "var(--background)",
        color: "var(--foreground)"
      },
      "&.cm-focused": {
        outline: "none"
      },
      // 内容区
      ".cm-content": {
        caretColor: "var(--foreground)",
        padding: "0 var(--editor-padding) var(--editor-bottom-space) var(--editor-padding)",
        fontFamily: "var(--editor-font)",
        fontSize: "var(--editor-font-size)",
        lineHeight: "var(--editor-line-height)",
        letterSpacing: "var(--editor-letter-spacing)"
      },
      ".cm-scroller": {
        overflow: "visible"
      },
      ".cm-line": {
        padding: "0"
      },

      // 光标
      ".cm-cursor, .cm-dropCursor": {
        borderLeftColor: "var(--foreground)"
      },

      // 占位符
      ".cm-placeholder": {
        color: "var(--muted-foreground)",
        fontStyle: "normal"
      },

      // 选中文本
      "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
        {
          backgroundColor: "color-mix(in srgb, var(--primary) 40%, transparent)"
        },

      // 搜索匹配 - 所有匹配项（包括代码块内）
      ".cm-searchMatch": {
        backgroundColor: "color-mix(in srgb, var(--warning) 30%, transparent) !important",
        borderRadius: "2px"
      },
      // 搜索匹配 - 当前选中的匹配项
      ".cm-searchMatch-selected": {
        backgroundColor: "color-mix(in srgb, var(--warning) 60%, transparent) !important",
        borderRadius: "2px"
      },

      // 括号匹配
      ".cm-matchingBracket": {
        backgroundColor: "var(--muted)",
        outline: "1px solid var(--border)",
        borderRadius: "2px"
      },
      ".cm-nonmatchingBracket": {
        backgroundColor: "color-mix(in srgb, var(--destructive) 10%, transparent)",
        outline: "1px solid var(--destructive)",
        borderRadius: "2px"
      },

      // 活动行
      ".cm-activeLine": {
        backgroundColor: "transparent"
      },

      // 行号槽
      ".cm-gutters": {
        backgroundColor: "var(--background)",
        color: "var(--muted-foreground)",
        border: "none"
      },
      ".cm-activeLineGutter": {
        backgroundColor: "transparent"
      },

      // 折叠
      ".cm-foldPlaceholder": {
        backgroundColor: "var(--muted)",
        border: "none",
        color: "var(--muted-foreground)"
      },

      // 提示框
      ".cm-tooltip": {
        backgroundColor: "var(--popover)",
        border: "1px solid var(--border)"
      },
      ".cm-tooltip .cm-tooltip-arrow:before": {
        borderTopColor: "var(--border)"
      },
      ".cm-tooltip .cm-tooltip-arrow:after": {
        borderTopColor: "var(--popover)"
      }
    },
    { dark: isDark }
  );

  // 语法高亮样式
  const highlightStyle = HighlightStyle.define([
    // 标题
    { tag: tags.heading1, fontWeight: "700", color: "var(--editor-title)" },
    { tag: tags.heading2, fontWeight: "700", color: "var(--editor-title)" },
    { tag: tags.heading3, fontWeight: "600", color: "var(--editor-title)" },
    { tag: tags.heading4, fontWeight: "600", color: "var(--editor-title)" },
    { tag: tags.heading5, fontWeight: "600", color: "var(--editor-title)" },
    { tag: tags.heading6, fontWeight: "600", color: "var(--editor-title)" },

    // 标题标记
    { tag: tags.heading, color: "var(--editor-title)" },

    // 粗体
    { tag: tags.strong, color: "var(--editor-strong)" },

    // 斜体
    { tag: tags.emphasis, color: "var(--editor-emphasis)" },

    // 删除线
    { tag: tags.strikethrough, color: "var(--editor-strikethrough)" },

    // 链接
    { tag: tags.link, color: "var(--editor-link)" },
    { tag: tags.url, color: "var(--editor-url)" },

    // 行内代码
    { tag: tags.monospace, fontFamily: "ui-monospace, monospace", color: "var(--editor-code)" },

    // 引用
    { tag: tags.quote, color: "var(--editor-quote)" },

    // 列表标记
    { tag: tags.list, color: "var(--editor-list)" },

    // 分割线
    { tag: tags.contentSeparator, color: "var(--editor-hr)" },

    // HTML标签和属性
    { tag: tags.tagName, color: "var(--editor-tag)" },
    { tag: tags.attributeName, color: "var(--editor-attribute)" },
    { tag: tags.attributeValue, color: "var(--editor-string)" },

    // 字符串
    { tag: tags.string, color: "var(--editor-string)" },

    // 关键字
    { tag: tags.keyword, color: "var(--editor-link)", fontWeight: "500" },

    // 注释和元信息
    { tag: tags.comment, color: "var(--editor-comment)", fontStyle: "italic" },

    // 标点符号
    { tag: tags.punctuation, color: "var(--tertiary-foreground)" },
    { tag: tags.bracket, color: "var(--tertiary-foreground)" },

    // 错误
    { tag: tags.invalid, color: "var(--destructive)", textDecoration: "underline wavy" }
  ]);

  return [baseTheme, syntaxHighlighting(highlightStyle)];
}
