import { useState, useCallback, DragEvent } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { useCodemirrorExtensions } from "./hooks/use-codemirror";
import { useEditorSearch } from "./hooks/use-editor-search";
import { SearchPanel } from "./search-panel";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useThemeStore } from "@/stores";
import { useTranslation } from "react-i18next";
import { EditorView } from "@codemirror/view";

// 支持的图片扩展名
const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico"];

/**
 * 判断文件是否为图片
 */
function isImageFile(fileName: string): boolean {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  return IMAGE_EXTENSIONS.includes(ext);
}

/**
 * 生成 Markdown 文件引用语法
 * 直接使用本地绝对路径，预览时会自动转换为 local-resource:// 协议
 */
function generateMarkdownFileReference(filePath: string, fileName: string): string {
  if (isImageFile(fileName)) {
    const altText = fileName.replace(/\.[^.]+$/, "");
    return `![${altText}](${filePath})`;
  } else {
    return `[${fileName}](${filePath})`;
  }
}

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

  // 处理拖拽进入
  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // 处理文件拖放
  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();

      const files = e.dataTransfer?.files;
      if (!files || files.length === 0 || !editorView) return;

      // 获取鼠标拖放位置对应的文档位置
      const dropPos = editorView.posAtCoords({ x: e.clientX, y: e.clientY });
      // 如果无法获取位置，则使用当前光标位置
      const pos = dropPos ?? editorView.state.selection.main.head;

      // 处理所有拖入的文件
      const markdownTexts: string[] = [];

      for (const file of Array.from(files)) {
        // 使用 Electron 的 webUtils.getPathForFile 获取文件路径
        const filePath = window.api.utils.getPathForFile(file);
        if (!filePath) continue;

        const markdownText = generateMarkdownFileReference(filePath, file.name);
        markdownTexts.push(markdownText);
      }

      if (markdownTexts.length === 0) return;

      const insertText = markdownTexts.join("\n");

      editorView.dispatch({
        changes: { from: pos, insert: insertText },
        selection: { anchor: pos + insertText.length }
      });

      // 聚焦编辑器
      editorView.focus();
    },
    [editorView]
  );

  return (
    <div className="relative h-full" onDragOver={handleDragOver} onDrop={handleDrop}>
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
