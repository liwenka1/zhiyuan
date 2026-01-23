import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { search } from "@codemirror/search";
import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { languages } from "@codemirror/language-data";
import { createFileDropExtension, createCustomKeymapExtension, createCustomTheme } from "./codemirror-extensions";

interface UseCodemirrorOptions {
  isDark?: boolean;
  onOpenSearch?: () => void;
}

export function useCodemirrorExtensions(options: UseCodemirrorOptions = {}): {
  extensions: Extension[];
  theme: Extension;
} {
  const { isDark = false, onOpenSearch } = options;

  const customTheme = createCustomTheme(isDark);
  const customKeymap = createCustomKeymapExtension(onOpenSearch);

  const extensions: Extension[] = [
    markdown({
      base: markdownLanguage,
      codeLanguages: languages
    }),
    EditorView.lineWrapping,
    search({ createPanel: () => ({ dom: document.createElement("div") }) }),
    customKeymap,
    createFileDropExtension()
  ];

  return { extensions, theme: customTheme };
}
