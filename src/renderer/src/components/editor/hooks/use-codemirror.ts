import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { EditorView } from "@codemirror/view";
import { syntaxHighlighting, HighlightStyle } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import type { Extension } from "@codemirror/state";

interface UseCodemirrorOptions {
  isDark?: boolean;
}

/**
 * 创建使用项目 CSS 变量的自定义编辑器主题
 */
function createCustomTheme(isDark: boolean): Extension {
  // 基础主题样式
  const baseTheme = EditorView.theme(
    {
      "&": {
        height: "auto",
        backgroundColor: "hsl(var(--background))",
        color: "hsl(var(--foreground))"
      },
      ".cm-content": {
        caretColor: "hsl(var(--foreground))",
        padding: "var(--editor-padding)",
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
      "&.cm-focused": {
        outline: "none"
      },
      ".cm-cursor, .cm-dropCursor": {
        borderLeftColor: "hsl(var(--foreground))"
      },
      "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
        {
          backgroundColor: "hsl(var(--selection))"
        },
      ".cm-activeLine": {
        backgroundColor: "transparent"
      },
      ".cm-selectionMatch": {
        backgroundColor: "hsl(var(--selection) / 0.5)"
      },
      ".cm-matchingBracket, .cm-nonmatchingBracket": {
        backgroundColor: "hsl(var(--muted))",
        outline: "1px solid hsl(var(--border))"
      },
      ".cm-gutters": {
        backgroundColor: "hsl(var(--background))",
        color: "hsl(var(--muted-foreground))",
        border: "none"
      },
      ".cm-activeLineGutter": {
        backgroundColor: "transparent"
      },
      ".cm-foldPlaceholder": {
        backgroundColor: "hsl(var(--muted))",
        border: "none",
        color: "hsl(var(--muted-foreground))"
      },
      ".cm-tooltip": {
        backgroundColor: "hsl(var(--popover))",
        border: "1px solid hsl(var(--border))"
      },
      ".cm-tooltip .cm-tooltip-arrow:before": {
        borderTopColor: "hsl(var(--border))"
      },
      ".cm-tooltip .cm-tooltip-arrow:after": {
        borderTopColor: "hsl(var(--popover))"
      }
    },
    { dark: isDark }
  );

  // 语法高亮样式
  // 编辑模式下保持统一字号，只用颜色和粗细区分元素
  const highlightStyle = HighlightStyle.define([
    // 标题：只用粗细区分，不改变字号
    { tag: tags.heading1, fontWeight: "700", color: "hsl(var(--foreground))" },
    { tag: tags.heading2, fontWeight: "700", color: "hsl(var(--foreground))" },
    { tag: tags.heading3, fontWeight: "600", color: "hsl(var(--foreground))" },
    { tag: tags.heading4, fontWeight: "600", color: "hsl(var(--foreground))" },
    { tag: tags.heading5, fontWeight: "600", color: "hsl(var(--foreground))" },
    { tag: tags.heading6, fontWeight: "600", color: "hsl(var(--foreground))" },
    // 文本样式
    { tag: tags.strong, fontWeight: "600", color: "hsl(var(--foreground))" },
    { tag: tags.emphasis, fontStyle: "italic", color: "hsl(var(--foreground))" },
    { tag: tags.strikethrough, textDecoration: "line-through", color: "hsl(var(--muted-foreground))" },
    // 链接
    { tag: tags.link, color: "hsl(var(--link))", textDecoration: "underline" },
    { tag: tags.url, color: "hsl(var(--link))" },
    // 代码
    { tag: tags.monospace, fontFamily: "ui-monospace, monospace", color: "hsl(var(--foreground))" },
    // 引用和列表
    { tag: tags.quote, color: "hsl(var(--muted-foreground))", fontStyle: "italic" },
    { tag: tags.list, color: "hsl(var(--foreground))" },
    // 其他
    { tag: tags.keyword, color: "hsl(var(--primary))", fontWeight: "500" },
    { tag: tags.comment, color: "hsl(var(--muted-foreground))", fontStyle: "italic" },
    { tag: tags.meta, color: "hsl(var(--muted-foreground))" },
    { tag: tags.invalid, color: "hsl(var(--destructive))" },
    { tag: tags.punctuation, color: "hsl(var(--tertiary-foreground))" },
    { tag: tags.contentSeparator, color: "hsl(var(--divider))" }
  ]);

  return [baseTheme, syntaxHighlighting(highlightStyle)];
}

export function useCodemirrorExtensions(options: UseCodemirrorOptions = {}): {
  extensions: Extension[];
  theme: Extension;
} {
  const { isDark = false } = options;

  const customTheme = createCustomTheme(isDark);

  const extensions: Extension[] = [
    markdown({
      base: markdownLanguage,
      codeLanguages: languages
    }),
    EditorView.lineWrapping
  ];

  return { extensions, theme: customTheme };
}
