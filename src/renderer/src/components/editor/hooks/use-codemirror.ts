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
      },
      // 行内代码
      ".cm-line .cm-monospace": {
        backgroundColor: "hsl(var(--editor-code-bg))",
        borderRadius: "3px",
        padding: "2px 4px"
      }
    },
    { dark: isDark }
  );

  // 语法高亮样式
  const highlightStyle = HighlightStyle.define([
    // 标题
    { tag: tags.heading1, fontWeight: "700", color: "hsl(var(--editor-title))" },
    { tag: tags.heading2, fontWeight: "700", color: "hsl(var(--editor-title))" },
    { tag: tags.heading3, fontWeight: "600", color: "hsl(var(--editor-title))" },
    { tag: tags.heading4, fontWeight: "600", color: "hsl(var(--editor-title))" },
    { tag: tags.heading5, fontWeight: "600", color: "hsl(var(--editor-title))" },
    { tag: tags.heading6, fontWeight: "600", color: "hsl(var(--editor-title))" },

    // 标题标记
    { tag: tags.processingInstruction, color: "hsl(var(--editor-title))" },
    { tag: tags.heading, color: "hsl(var(--editor-title))" },

    // 删除线
    { tag: tags.strikethrough, color: "hsl(var(--muted-foreground))" },

    // 链接
    { tag: tags.link, color: "hsl(var(--editor-link))" },
    { tag: tags.url, color: "hsl(var(--editor-url))" },

    // 行内代码
    { tag: tags.monospace, fontFamily: "ui-monospace, monospace", color: "hsl(var(--editor-code))" },

    // 引用
    { tag: tags.quote, color: "hsl(var(--editor-quote))" },

    // 列表标记
    { tag: tags.list, color: "hsl(var(--editor-list))" },

    // 分割线
    { tag: tags.contentSeparator, color: "hsl(var(--editor-hr))" },

    // HTML标签和属性
    { tag: tags.tagName, color: "hsl(var(--editor-tag))" },
    { tag: tags.attributeName, color: "hsl(var(--editor-attribute))" },
    { tag: tags.attributeValue, color: "hsl(var(--editor-string))" },

    // 字符串
    { tag: tags.string, color: "hsl(var(--editor-string))" },

    // 关键字
    { tag: tags.keyword, color: "hsl(var(--editor-link))", fontWeight: "500" },

    // 注释和元信息
    { tag: tags.comment, color: "hsl(var(--editor-comment))", fontStyle: "italic" },
    { tag: tags.meta, color: "hsl(var(--editor-meta))" },

    // 标点符号
    { tag: tags.punctuation, color: "hsl(var(--tertiary-foreground))" },
    { tag: tags.bracket, color: "hsl(var(--tertiary-foreground))" },

    // 错误
    { tag: tags.invalid, color: "hsl(var(--destructive))", textDecoration: "underline wavy" }
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
