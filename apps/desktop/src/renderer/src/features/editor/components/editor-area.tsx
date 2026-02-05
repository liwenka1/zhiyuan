import { useEffect, useMemo, memo, useRef } from "react";
import { EditorToolbar } from "./editor-toolbar";
import { EditorContent } from "./editor-content";
import { PreviewContent } from "./preview-content";
import { EmptyEditor } from "./empty-state";
import { useViewStore, useNoteStore } from "@/stores";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle, usePanelRef } from "@/components/ui/resizable";
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
    onChange
  }: {
    noteId: string;
    content: string;
    notePath?: string;
    isActive: boolean;
    editorMode: "edit" | "preview" | "split";
    splitLayout: number[];
    setSplitLayout: (sizes: number[]) => void;
    onChange?: (content: string) => void;
  }) {
    const editorPanelRef = usePanelRef();
    const previewPanelRef = usePanelRef();
    const isDraggingRef = useRef(false);
    const editorSizeRef = useRef(splitLayout[0]);
    const previewSizeRef = useRef(splitLayout[1]);
    const isProgrammaticRef = useRef(false);
    const editorPanelId = `${noteId}-editor`;
    const previewPanelId = `${noteId}-preview`;

    const handleContentChange = (value: string) => {
      onChange?.(value);
    };

    const handleLayoutChanged = (layout: { [panelId: string]: number }) => {
      if (editorMode !== "split" || isProgrammaticRef.current) {
        return;
      }
      const editorSize = layout[editorPanelId];
      const previewSize = layout[previewPanelId];
      if (typeof editorSize === "number" && typeof previewSize === "number") {
        editorSizeRef.current = editorSize;
        previewSizeRef.current = previewSize;
        setSplitLayout([editorSize, previewSize]);
      }
    };

    const resetSplitToDefault = () => {
      if (editorMode !== "split") return;
      if (!editorPanelRef.current || !previewPanelRef.current) return;
      isProgrammaticRef.current = true;
      editorPanelRef.current.resize("50%");
      previewPanelRef.current.resize("50%");
      editorSizeRef.current = 50;
      previewSizeRef.current = 50;
      setSplitLayout([50, 50]);
      isProgrammaticRef.current = false;
    };

    useEffect(() => {
      if (editorMode !== "split") {
        return;
      }
      if (!editorPanelRef.current || !previewPanelRef.current) return;

      isProgrammaticRef.current = true;
      if (!isDraggingRef.current) {
        editorPanelRef.current.resize(`${splitLayout[0]}%`);
        previewPanelRef.current.resize(`${splitLayout[1]}%`);
      }
      isProgrammaticRef.current = false;
    }, [editorMode, editorPanelRef, previewPanelRef, splitLayout]);

    useEffect(() => {
      const handlePointerUp = () => {
        isDraggingRef.current = false;
      };
      document.addEventListener("pointerup", handlePointerUp);
      return () => document.removeEventListener("pointerup", handlePointerUp);
    }, []);

    useEffect(() => {
      editorSizeRef.current = splitLayout[0];
      previewSizeRef.current = splitLayout[1];
      if (editorMode !== "split") {
        isDraggingRef.current = false;
      }
    }, [editorMode, splitLayout]);

    // 根据编辑模式计算初始尺寸
    const editorDefaultSize = editorMode === "edit" ? "100%" : editorMode === "preview" ? "0%" : `${splitLayout[0]}%`;
    const previewDefaultSize = editorMode === "edit" ? "0%" : editorMode === "preview" ? "100%" : `${splitLayout[1]}%`;

    return (
      <div className={isActive ? "h-full" : "hidden"}>
        {editorMode === "split" ? (
          <ResizablePanelGroup orientation="horizontal" className="h-full" onLayoutChanged={handleLayoutChanged}>
            <ResizablePanel
              id={editorPanelId}
              panelRef={editorPanelRef}
              defaultSize={editorDefaultSize}
              minSize="30%"
              collapsible={false}
            >
              <EditorContent content={content} onChange={handleContentChange} noteId={noteId} />
            </ResizablePanel>

            <ResizableHandle
              className="bg-border hover:bg-primary w-px transition-colors"
              onPointerDown={() => {
                isDraggingRef.current = true;
              }}
              onDoubleClick={resetSplitToDefault}
            />

            <ResizablePanel
              id={previewPanelId}
              panelRef={previewPanelRef}
              defaultSize={previewDefaultSize}
              minSize="30%"
              collapsible={false}
            >
              <PreviewContent content={content} notePath={notePath} noteId={noteId} />
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : editorMode === "edit" ? (
          <EditorContent content={content} onChange={handleContentChange} noteId={noteId} />
        ) : (
          <PreviewContent content={content} notePath={notePath} noteId={noteId} />
        )}
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
