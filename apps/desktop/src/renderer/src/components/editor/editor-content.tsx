import { useState, useCallback } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { useCodemirrorExtensions } from "./hooks/use-codemirror-extensions";
import { useEditorSearch } from "./hooks/use-editor-search";
import { SearchPanel } from "./search-panel";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useThemeStore } from "@/stores";
import { useTranslation } from "react-i18next";
import { EditorView } from "@codemirror/view";

interface EditorContentProps {
  content: string;
  onChange: (content: string) => void;
  noteId?: string;
}

export function EditorContent({ content, onChange, noteId }: EditorContentProps) {
  const theme = useThemeStore((state) => state.theme);
  const { t } = useTranslation("editor");
  const [editorView, setEditorView] = useState<EditorView | null>(null);

  // 搜索功能
  const search = useEditorSearch(editorView);

  // 处理编辑器创建，获取 EditorView 实例
  const handleCreateEditor = useCallback((view: EditorView) => {
    setEditorView(view);
  }, []);

  const { extensions, theme: editorTheme } = useCodemirrorExtensions({
    isDark: theme === "dark",
    onOpenSearch: search.open
  });

  return (
    <div className="relative h-full">
      <SearchPanel search={search} />
      <ScrollArea className="h-full">
        <CodeMirror
          key={noteId}
          value={content}
          height="auto"
          theme={editorTheme}
          extensions={extensions}
          onChange={onChange}
          onCreateEditor={handleCreateEditor}
          placeholder={t("placeholder")}
          basicSetup={{
            lineNumbers: false,
            foldGutter: false,
            highlightActiveLine: false,
            highlightSelectionMatches: false,
            bracketMatching: true,
            closeBrackets: true,
            autocompletion: false,
            searchKeymap: false
          }}
        />
      </ScrollArea>
    </div>
  );
}
