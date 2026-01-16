import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { EditorView, keymap } from "@codemirror/view";
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
        backgroundColor: "var(--background)",
        color: "var(--foreground)"
      },
      ".cm-content": {
        caretColor: "var(--foreground)",
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
        borderLeftColor: "var(--foreground)"
      },
      "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
        {
          backgroundColor: "var(--selection)"
        },
      ".cm-activeLine": {
        backgroundColor: "transparent"
      },
      ".cm-selectionMatch": {
        backgroundColor: "color-mix(in srgb, var(--selection) 50%, transparent)"
      },
      ".cm-matchingBracket, .cm-nonmatchingBracket": {
        backgroundColor: "var(--muted)",
        outline: "1px solid var(--border)"
      },
      ".cm-gutters": {
        backgroundColor: "var(--background)",
        color: "var(--muted-foreground)",
        border: "none"
      },
      ".cm-activeLineGutter": {
        backgroundColor: "transparent"
      },
      ".cm-foldPlaceholder": {
        backgroundColor: "var(--muted)",
        border: "none",
        color: "var(--muted-foreground)"
      },
      ".cm-tooltip": {
        backgroundColor: "var(--popover)",
        border: "1px solid var(--border)"
      },
      ".cm-tooltip .cm-tooltip-arrow:before": {
        borderTopColor: "var(--border)"
      },
      ".cm-tooltip .cm-tooltip-arrow:after": {
        borderTopColor: "var(--popover)"
      },
      // 行内代码
      ".cm-line .cm-monospace": {
        backgroundColor: "var(--editor-code-bg)",
        borderRadius: "3px",
        padding: "2px 4px"
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
    { tag: tags.processingInstruction, color: "var(--editor-title)" },
    { tag: tags.heading, color: "var(--editor-title)" },

    // 删除线
    { tag: tags.strikethrough, color: "var(--muted-foreground)" },

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
    { tag: tags.meta, color: "var(--editor-meta)" },

    // 标点符号
    { tag: tags.punctuation, color: "var(--tertiary-foreground)" },
    { tag: tags.bracket, color: "var(--tertiary-foreground)" },

    // 错误
    { tag: tags.invalid, color: "var(--destructive)", textDecoration: "underline wavy" }
  ]);

  return [baseTheme, syntaxHighlighting(highlightStyle)];
}

/**
 * 创建禁用默认快捷键的 keymap
 * 禁用 CodeMirror 的内置搜索和替换快捷键，让用户使用应用自带的搜索功能
 */
function createDisabledKeymapExtension(): Extension {
  // 创建一个通用的处理器，返回 true 表示已处理事件，阻止默认行为
  const disableHandler = () => true;

  return keymap.of([
    // 禁用搜索快捷键 (Cmd+F / Ctrl+F)
    { key: "Mod-f", run: disableHandler },
    // 禁用替换快捷键 (Cmd+H / Ctrl+H)
    { key: "Mod-h", run: disableHandler },
    // 禁用查找下一个 (Cmd+G / Ctrl+G)
    { key: "Mod-g", run: disableHandler },
    // 禁用查找上一个 (Shift+Cmd+G / Shift+Ctrl+G)
    { key: "Shift-Mod-g", run: disableHandler },
    // 禁用选择所有匹配项 (Cmd+Shift+L / Ctrl+Shift+L)
    { key: "Shift-Mod-l", run: disableHandler },
    // 禁用 Alt+G (跳转到行)
    { key: "Alt-g", run: disableHandler }
  ]);
}

export function useCodemirrorExtensions(options: UseCodemirrorOptions = {}): {
  extensions: Extension[];
  theme: Extension;
} {
  const { isDark = false } = options;

  const customTheme = createCustomTheme(isDark);
  const disabledKeymap = createDisabledKeymapExtension();

  const extensions: Extension[] = [
    markdown({
      base: markdownLanguage,
      codeLanguages: languages
    }),
    EditorView.lineWrapping,
    disabledKeymap // 添加禁用的快捷键配置
  ];

  return { extensions, theme: customTheme };
}
