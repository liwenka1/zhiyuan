import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { githubLight, githubDark } from "@uiw/codemirror-theme-github";
import { EditorView } from "@codemirror/view";
import type { Extension } from "@codemirror/state";

interface UseCodemirrorOptions {
  isDark?: boolean;
}

export function useCodemirrorExtensions(options: UseCodemirrorOptions = {}): {
  extensions: Extension[];
  theme: Extension;
} {
  const { isDark = false } = options;

  const customTheme = EditorView.theme({
    "&": {
      height: "auto"
    },
    ".cm-scroller": {
      overflow: "visible"
    },
    ".cm-content": {
      padding: "var(--editor-padding)"
    },
    ".cm-line": {
      padding: "0"
    }
  });

  const extensions: Extension[] = [
    markdown({
      base: markdownLanguage,
      codeLanguages: languages
    }),
    EditorView.lineWrapping,
    customTheme
  ];

  const theme = isDark ? githubDark : githubLight;

  return { extensions, theme };
}
