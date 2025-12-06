import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { githubLight, githubDark } from "@uiw/codemirror-theme-github";
import type { Extension } from "@codemirror/state";

interface UseCodemirrorOptions {
  isDark?: boolean;
}

export function useCodemirrorExtensions(options: UseCodemirrorOptions = {}): {
  extensions: Extension[];
  theme: Extension;
} {
  const { isDark = false } = options;

  const extensions: Extension[] = [
    markdown({
      base: markdownLanguage,
      codeLanguages: languages
    })
  ];

  const theme = isDark ? githubDark : githubLight;

  return { extensions, theme };
}
