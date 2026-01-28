import { useRef, useEffect } from "react";
import { EditorToolbar } from "./editor-toolbar";
import { EditorContent } from "./editor-content";
import { PreviewContent } from "./preview-content";
import { EmptyEditor } from "./empty-state";
import { useViewStore } from "@/stores";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { ImperativePanelHandle } from "react-resizable-panels";

interface EditorAreaProps {
  content?: string;
  onChange?: (content: string) => void;
  hasNote?: boolean;
  noteId?: string;
  notePath?: string; // 笔记的完整文件路径，用于解析相对资源路径
}

export function EditorArea({ content = "", onChange, hasNote = false, noteId, notePath }: EditorAreaProps) {
  const editorMode = useViewStore((state) => state.editorMode);
  const splitLayout = useViewStore((state) => state.splitLayout);
  const setSplitLayout = useViewStore((state) => state.setSplitLayout);
  const resetSplitLayout = useViewStore((state) => state.resetSplitLayout);

  const editorPanelRef = useRef<ImperativePanelHandle>(null);
  const previewPanelRef = useRef<ImperativePanelHandle>(null);

  const handleContentChange = (value: string) => {
    onChange?.(value);
  };

  // 统一调整面板大小
  const resizePanels = (editorSize: number, previewSize: number) => {
    editorPanelRef.current?.resize(editorSize);
    previewPanelRef.current?.resize(previewSize);
  };

  // 双击分割线重置到 50/50
  const handleResetPanels = () => {
    resizePanels(50, 50);
    resetSplitLayout();
  };

  // 监听分栏模式下的布局变化（用户拖动）
  const handleLayoutChange = (sizes: number[]) => {
    // 只在分栏模式下保存
    if (editorMode === "split" && sizes.length === 2) {
      setSplitLayout([sizes[0], sizes[1]]);
    }
  };

  // 模式切换时自动调整面板大小
  useEffect(() => {
    if (editorMode === "edit") {
      resizePanels(100, 0);
    } else if (editorMode === "preview") {
      resizePanels(0, 100);
    } else if (editorMode === "split") {
      // 恢复分栏模式保存的比例
      resizePanels(splitLayout[0], splitLayout[1]);
    }
  }, [editorMode, splitLayout]);

  // 如果没有选中笔记，显示空状态
  if (!hasNote && !content) {
    return (
      <div className="flex h-full flex-col">
        <EditorToolbar />
        <div className="flex-1">
          <EmptyEditor />
        </div>
      </div>
    );
  }

  const isSplit = editorMode === "split";

  // 使用统一的 ResizablePanelGroup 布局
  // 两个面板始终存在，通过 useEffect 动态调整大小
  // 编辑模式：编辑器 100%, 预览 0
  // 预览模式：编辑器 0, 预览 100%
  // 分栏模式：编辑器 50%, 预览 50%（可拖动）
  return (
    <div className="flex h-full flex-col">
      <EditorToolbar content={content} />
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal" onLayout={handleLayoutChange} className="h-full">
          {/* 编辑器面板（始终存在，保持滚动位置）*/}
          <ResizablePanel ref={editorPanelRef} defaultSize={50} minSize={isSplit ? 30 : 0} collapsible={!isSplit}>
            <EditorContent content={content} onChange={handleContentChange} noteId={noteId} />
          </ResizablePanel>

          {/* 分割线（仅在分栏模式显示）*/}
          {isSplit && (
            <ResizableHandle
              className="bg-border hover:bg-primary w-px transition-colors"
              onDoubleClick={handleResetPanels}
            />
          )}

          {/* 预览面板（始终存在，保持滚动位置）*/}
          <ResizablePanel ref={previewPanelRef} defaultSize={50} minSize={isSplit ? 30 : 0} collapsible={!isSplit}>
            <PreviewContent content={content} notePath={notePath} />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
