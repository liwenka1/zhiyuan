import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { search } from "@codemirror/search";
import { EditorState, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { ExternalChange } from "@uiw/react-codemirror";
import { languages } from "@codemirror/language-data";
import { createFileDropExtension, createCustomKeymapExtension, createCustomTheme } from "./codemirror-extensions";

interface UseCodemirrorOptions {
  isDark?: boolean;
  onOpenSearch?: () => void;
  canEdit?: () => boolean;
}

export function useCodemirrorExtensions(options: UseCodemirrorOptions = {}): {
  extensions: Extension[];
  theme: Extension;
} {
  const { isDark = false, onOpenSearch, canEdit } = options;

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
  if (canEdit) {
    // Check the store before any change, including transactions that arrive before React updates readOnly.
    extensions.push(
      EditorState.changeFilter.of((tr) => !tr.docChanged || Boolean(tr.annotation(ExternalChange)) || canEdit())
    );
  }

  return { extensions, theme: customTheme };
}
