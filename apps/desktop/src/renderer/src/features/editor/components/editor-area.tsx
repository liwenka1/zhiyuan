import { useRef, useEffect, useMemo, memo } from "react";
import { EditorToolbar } from "./editor-toolbar";
import { EditorContent } from "./editor-content";
import { PreviewContent } from "./preview-content";
import { EmptyEditor } from "./empty-state";
import { useViewStore, useNoteStore } from "@/stores";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { ImperativePanelHandle } from "react-resizable-panels";
import type { Note } from "@/types";

interface EditorAreaProps {
  content?: string;
  onChange?: (content: string) => void;
  hasNote?: boolean;
  noteId?: string;
  openNoteIds?: string[];
  notes?: Note[];
  onShowNoteInExplorer?: (note: { id: string; title: string; updatedAt?: string; isPinned?: boolean }) => void;
  onRenameNote?: (note: { id: string; title: string; updatedAt?: string; isPinned?: boolean }) => void;
  onDuplicateNote?: (note: { id: string; title: string; updatedAt?: string; isPinned?: boolean }) => void;
  onExportNote?: (
    note: { id: string; title: string; updatedAt?: string; isPinned?: boolean },
    format: "html" | "pdf" | "pdf-pages" | "image" | "image-pages"
  ) => void;
  onDeleteNote?: (note: { id: string; title: string; updatedAt?: string; isPinned?: boolean }) => void;
}

export function EditorArea({
  content = "",
  onChange,
  hasNote = false,
  noteId,
  openNoteIds = [],
  notes = [],
  onShowNoteInExplorer,
  onRenameNote,
  onDuplicateNote,
  onExportNote,
  onDeleteNote
}: EditorAreaProps) {
  const editorMode = useViewStore((state) => state.editorMode);
  const splitLayout = useViewStore((state) => state.splitLayout);
  const setSplitLayout = useViewStore((state) => state.setSplitLayout);
  const resetSplitLayout = useViewStore((state) => state.resetSplitLayout);
  const playingNoteIds = useNoteStore((state) => state.playingNoteIds);

  const openNotes = useMemo(
    () => openNoteIds.map((id) => notes.find((note) => note.id === id)).filter(Boolean) as Note[],
    [notes, openNoteIds]
  );

  // 智能过滤：只渲染必要的笔记实例
  // 1. 当前活跃的笔记（正在编辑）
  // 2. 正在播放媒体的笔记（后台播放）
  const notesToRender = useMemo(
    () => openNotes.filter((note) => note.id === noteId || playingNoteIds.includes(note.id)),
    [openNotes, noteId, playingNoteIds]
  );

  // 如果没有选中笔记，显示空状态
  if (!hasNote && !content && notesToRender.length === 0) {
    return (
      <div className="flex h-full flex-col">
        <EditorToolbar />
        <div className="flex-1">
          <EmptyEditor />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <EditorToolbar
        content={content}
        onShowNoteInExplorer={onShowNoteInExplorer}
        onRenameNote={onRenameNote}
        onDuplicateNote={onDuplicateNote}
        onExportNote={onExportNote}
        onDeleteNote={onDeleteNote}
      />
      <div className="flex-1 overflow-hidden">
        {notesToRender.map((note) => (
          <OpenNotePanels
            key={note.id}
            noteId={note.id}
            content={note.content}
            notePath={note.filePath}
            isActive={note.id === noteId}
            editorMode={editorMode}
            splitLayout={splitLayout}
            setSplitLayout={(sizes) => setSplitLayout([sizes[0] ?? 50, sizes[1] ?? 50])}
            resetSplitLayout={resetSplitLayout}
            onChange={onChange}
          />
        ))}
      </div>
    </div>
  );
}

const OpenNotePanels = memo(
  function OpenNotePanels({
    noteId,
    content,
    notePath,
    isActive,
    editorMode,
    splitLayout,
    setSplitLayout,
    resetSplitLayout,
    onChange
  }: {
    noteId: string;
    content: string;
    notePath?: string;
    isActive: boolean;
    editorMode: "edit" | "preview" | "split";
    splitLayout: number[];
    setSplitLayout: (sizes: number[]) => void;
    resetSplitLayout: () => void;
    onChange?: (content: string) => void;
  }) {
    const editorPanelRef = useRef<ImperativePanelHandle>(null);
    const previewPanelRef = useRef<ImperativePanelHandle>(null);
    const isSplit = editorMode === "split";

    const handleContentChange = (value: string) => {
      onChange?.(value);
    };

    const resizePanels = (editorSize: number, previewSize: number) => {
      editorPanelRef.current?.resize(editorSize);
      previewPanelRef.current?.resize(previewSize);
    };

    const handleResetPanels = () => {
      resizePanels(50, 50);
      resetSplitLayout();
    };

    const handleLayoutChange = (sizes: number[]) => {
      if (editorMode === "split" && sizes.length === 2) {
        setSplitLayout([sizes[0], sizes[1]]);
      }
    };

    useEffect(() => {
      if (editorMode === "edit") {
        resizePanels(100, 0);
      } else if (editorMode === "preview") {
        resizePanels(0, 100);
      } else if (editorMode === "split") {
        resizePanels(splitLayout[0], splitLayout[1]);
      }
    }, [editorMode, splitLayout]);

    return (
      <div className={isActive ? "h-full" : "hidden"}>
        <ResizablePanelGroup direction="horizontal" onLayout={handleLayoutChange} className="h-full">
          <ResizablePanel ref={editorPanelRef} defaultSize={50} minSize={isSplit ? 30 : 0} collapsible={!isSplit}>
            <EditorContent content={content} onChange={handleContentChange} noteId={noteId} />
          </ResizablePanel>

          {isSplit && (
            <ResizableHandle
              className="bg-border hover:bg-primary w-px transition-colors"
              onDoubleClick={handleResetPanels}
            />
          )}

          <ResizablePanel ref={previewPanelRef} defaultSize={50} minSize={isSplit ? 30 : 0} collapsible={!isSplit}>
            <PreviewContent content={content} notePath={notePath} noteId={noteId} />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    );
  },
  (prev, next) =>
    prev.noteId === next.noteId &&
    prev.content === next.content &&
    prev.notePath === next.notePath &&
    prev.isActive === next.isActive &&
    prev.editorMode === next.editorMode &&
    prev.splitLayout[0] === next.splitLayout[0] &&
    prev.splitLayout[1] === next.splitLayout[1]
);
