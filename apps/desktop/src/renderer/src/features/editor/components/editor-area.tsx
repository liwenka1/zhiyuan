import { useEffect, useMemo, useCallback, memo, useRef } from "react";
import { EditorToolbar } from "./editor-toolbar";
import { EditorContent } from "./editor-content";
import { PreviewContent } from "./preview-content";
import { EmptyEditor } from "./empty-state";
import { useViewStore, useNoteStore } from "@/stores";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle, useGroupRef } from "@/components/ui/resizable";
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
  onPushToGitHub?: (note: { id: string; title: string; updatedAt?: string; isPinned?: boolean }) => void;
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
  onDeleteNote,
  onPushToGitHub
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
        onPushToGitHub={onPushToGitHub}
      />
      <div className="flex-1 overflow-hidden">
        {notesToRender.map((note) => (
          <OpenNotePanels
            key={note.id}
            noteId={note.id}
            noteTitle={note.title}
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

/**
 * 始终挂载 ResizablePanelGroup，通过 groupRef.setLayout() 一次性切换整个布局，
 * 避免 EditorContent / PreviewContent 在模式切换时反复卸载和重新挂载。
 *
 * - edit 模式：editor = 100%, preview = 0%
 * - preview 模式：editor = 0%, preview = 100%
 * - split 模式：按 splitLayout 分配比例
 */
const OpenNotePanels = memo(
  function OpenNotePanels({
    noteId,
    noteTitle,
    content,
    notePath,
    isActive,
    editorMode,
    splitLayout,
    setSplitLayout,
    onChange
  }: {
    noteId: string;
    noteTitle: string;
    content: string;
    notePath?: string;
    isActive: boolean;
    editorMode: "edit" | "preview" | "split";
    splitLayout: number[];
    setSplitLayout: (sizes: number[]) => void;
    onChange?: (content: string) => void;
  }) {
    const groupRef = useGroupRef();
    const isProgrammaticRef = useRef(false);
    const isDraggingRef = useRef(false);
    const splitLayoutRef = useRef(splitLayout);
    const editorModeRef = useRef(editorMode);
    const editorPanelId = `${noteId}-editor`;
    const previewPanelId = `${noteId}-preview`;

    // 保持 ref 同步
    useEffect(() => {
      splitLayoutRef.current = splitLayout;
    }, [splitLayout]);
    useEffect(() => {
      editorModeRef.current = editorMode;
    }, [editorMode]);

    const handleContentChange = useCallback(
      (value: string) => {
        onChange?.(value);
      },
      [onChange]
    );

    // 仅在 split 模式下的用户拖动才保存布局
    const handleLayoutChanged = useCallback(
      (layout: { [panelId: string]: number }) => {
        if (editorModeRef.current !== "split" || isProgrammaticRef.current) {
          return;
        }
        const editorSize = layout[editorPanelId];
        const previewSize = layout[previewPanelId];
        if (typeof editorSize === "number" && typeof previewSize === "number") {
          setSplitLayout([editorSize, previewSize]);
        }
      },
      [editorPanelId, previewPanelId, setSplitLayout]
    );

    // 双击 handle 重置为 50/50
    const resetSplitToDefault = useCallback(() => {
      if (editorModeRef.current !== "split" || !groupRef.current) return;
      isProgrammaticRef.current = true;
      groupRef.current.setLayout({ [editorPanelId]: 50, [previewPanelId]: 50 });
      setSplitLayout([50, 50]);
      isProgrammaticRef.current = false;
    }, [groupRef, editorPanelId, previewPanelId, setSplitLayout]);

    // 计算目标布局的工具函数
    const getTargetLayout = useCallback(
      (mode: string) => {
        if (mode === "edit") {
          return { [editorPanelId]: 100, [previewPanelId]: 0 };
        } else if (mode === "preview") {
          return { [editorPanelId]: 0, [previewPanelId]: 100 };
        } else {
          const layout = splitLayoutRef.current;
          return { [editorPanelId]: layout[0], [previewPanelId]: layout[1] };
        }
      },
      [editorPanelId, previewPanelId]
    );

    // 核心 effect：只在 editorMode 变化时通过 setLayout 一次性设置整个布局
    useEffect(() => {
      if (!groupRef.current) return;

      isProgrammaticRef.current = true;
      groupRef.current.setLayout(getTargetLayout(editorMode));
      isProgrammaticRef.current = false;

      if (editorMode !== "split") {
        isDraggingRef.current = false;
      }
    }, [editorMode, groupRef, getTargetLayout]);

    // 监听 pointerup 停止拖动标记
    useEffect(() => {
      const handlePointerUp = () => {
        isDraggingRef.current = false;
      };
      document.addEventListener("pointerup", handlePointerUp);
      return () => document.removeEventListener("pointerup", handlePointerUp);
    }, []);

    const isSplit = editorMode === "split";

    return (
      <div className={isActive ? "h-full" : "hidden"}>
        <ResizablePanelGroup
          orientation="horizontal"
          className="h-full"
          groupRef={groupRef}
          onLayoutChanged={handleLayoutChanged}
        >
          <ResizablePanel
            id={editorPanelId}
            defaultSize={editorMode === "preview" ? "0%" : editorMode === "split" ? `${splitLayout[0]}%` : "100%"}
            minSize="0%"
            collapsible
            collapsedSize="0%"
          >
            <EditorContent content={content} onChange={handleContentChange} noteId={noteId} />
          </ResizablePanel>

          <ResizableHandle
            className={
              isSplit
                ? "bg-border hover:bg-primary w-px transition-colors"
                : "pointer-events-none w-0 border-0 bg-transparent p-0 opacity-0"
            }
            onPointerDown={() => {
              if (isSplit) isDraggingRef.current = true;
            }}
            onDoubleClick={resetSplitToDefault}
          />

          <ResizablePanel
            id={previewPanelId}
            defaultSize={editorMode === "edit" ? "0%" : editorMode === "split" ? `${splitLayout[1]}%` : "100%"}
            minSize="0%"
            collapsible
            collapsedSize="0%"
          >
            <PreviewContent content={content} notePath={notePath} noteId={noteId} noteTitle={noteTitle} />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    );
  },
  (prev, next) =>
    prev.noteId === next.noteId &&
    prev.noteTitle === next.noteTitle &&
    prev.content === next.content &&
    prev.notePath === next.notePath &&
    prev.isActive === next.isActive &&
    prev.editorMode === next.editorMode &&
    prev.splitLayout[0] === next.splitLayout[0] &&
    prev.splitLayout[1] === next.splitLayout[1]
);
