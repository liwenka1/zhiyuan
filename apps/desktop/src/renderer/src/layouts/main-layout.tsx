import { ReactNode, CSSProperties, useRef, useEffect, useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { TitleBar } from "@/components/app";
import { usePlatform } from "@/hooks";
import { useViewStore } from "@/stores";
import { cn } from "@/lib/utils";
import type { ImperativePanelHandle } from "react-resizable-panels";

interface MainLayoutProps {
  leftSidebar: ReactNode;
  rightSidebar: ReactNode;
  mainContent: ReactNode;
}

// 动画过渡样式
const panelTransitionStyle = {
  transition: "flex-basis 0.25s cubic-bezier(0.32, 0.72, 0, 1), flex-grow 0.25s cubic-bezier(0.32, 0.72, 0, 1), flex-shrink 0.25s cubic-bezier(0.32, 0.72, 0, 1)"
};

export function MainLayout({ leftSidebar, rightSidebar, mainContent }: MainLayoutProps) {
  const { isMac, isWindows } = usePlatform();
  const showFolderSidebar = useViewStore((state) => state.showFolderSidebar);
  const toggleFolderSidebar = useViewStore((state) => state.toggleFolderSidebar);
  const folderPanelRef = useRef<ImperativePanelHandle>(null);
  const notePanelRef = useRef<ImperativePanelHandle>(null);
  
  // 保存笔记列表的宽度
  const [noteListSize, setNoteListSize] = useState(25);
  
  // 是否正在拖拽 - 拖拽时禁用动画
  const [isDragging, setIsDragging] = useState(false);

  // 使用 collapse/expand API 控制面板
  useEffect(() => {
    const folderPanel = folderPanelRef.current;
    const notePanel = notePanelRef.current;
    if (!folderPanel || !notePanel) return;

    if (showFolderSidebar) {
      // 展开文件夹
      folderPanel.expand();
      // 恢复笔记列表的宽度
      notePanel.resize(noteListSize);
    } else {
      // 收起文件夹
      folderPanel.collapse();
      // 保持笔记列表宽度不变
      notePanel.resize(noteListSize);
    }
  }, [showFolderSidebar, noteListSize]);

  // 外层容器样式（Windows 的 padding 在外层）
  const outerStyle: CSSProperties = {
    paddingTop: isWindows ? "calc(var(--titlebar-height-windows) + 1px)" : "0px"
  };

  // 内层容器样式（Mac 的 padding 在内层）
  const innerStyle: CSSProperties = {
    paddingTop: isMac ? "var(--titlebar-height-mac)" : "0px"
  };

  // 分割线样式（macOS 下延伸到顶部）
  const handleClassName = cn(
    "bg-divider hover:bg-highlight/50 w-px transition-colors duration-150",
    isMac && "relative -top-(--titlebar-height-mac)"
  );

  const handleStyle: CSSProperties | undefined = isMac
    ? { height: "calc(100% + var(--titlebar-height-mac))" }
    : undefined;

  return (
    <div className="bg-background flex h-screen w-full overflow-hidden" style={outerStyle}>
      {/* 自定义标题栏（Windows 拖拽区域） */}
      <TitleBar />
      
      {/* 固定的文件夹切换按钮 - 浮在左侧面板上方 */}
      <Button
        variant="ghost"
        size="sm"
        className="absolute h-7 w-7 shrink-0 p-0 z-10"
        style={{
          top: isMac ? "calc(var(--titlebar-height-mac) + 12px)" : (isWindows ? "calc(var(--titlebar-height-windows) + 13px)" : "12px"),
          left: "12px"
        }}
        onClick={toggleFolderSidebar}
      >
        {showFolderSidebar ? (
          <PanelLeftClose className="h-4 w-4" />
        ) : (
          <PanelLeftOpen className="h-4 w-4" />
        )}
      </Button>
      
      <ResizablePanelGroup
        direction="horizontal"
        className={cn("h-full", isWindows && "border-border border-t")}
        style={innerStyle}
      >
        {/* 左侧文件夹树（收起时完全消失，按钮固定在左上角） */}
        <ResizablePanel 
          ref={folderPanelRef}
          defaultSize={15} 
          minSize={15}
          maxSize={20} 
          collapsible={true}
          className="bg-background overflow-hidden"
          style={isDragging ? undefined : panelTransitionStyle}
        >
          <aside className="no-select h-full">
            {leftSidebar}
          </aside>
        </ResizablePanel>

        {/* 分割线 */}
        <ResizableHandle 
          className={handleClassName} 
          style={handleStyle}
          onDragging={setIsDragging}
        />

        {/* 中间笔记列表 - 保存并恢复宽度 */}
        <ResizablePanel 
          ref={notePanelRef}
          defaultSize={25} 
          minSize={20} 
          maxSize={35}
          onResize={(size) => {
            // 保存笔记列表的宽度
            setNoteListSize(size);
          }}
          className="bg-background"
          style={isDragging ? undefined : panelTransitionStyle}
        >
          <aside className="no-select h-full">{rightSidebar}</aside>
        </ResizablePanel>

        {/* 分割线 */}
        <ResizableHandle 
          className={handleClassName} 
          style={handleStyle}
          onDragging={setIsDragging}
        />

        {/* 右侧编辑区 - 自动填充剩余空间 */}
        <ResizablePanel 
          className="bg-background"
          style={isDragging ? undefined : panelTransitionStyle}
        >
          <main className="allow-select h-full min-w-0 overflow-hidden">{mainContent}</main>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
