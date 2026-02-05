import { ReactNode, CSSProperties, useEffect, useRef } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle, usePanelRef } from "@/components/ui/resizable";
import type { PanelSize } from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { TitleBar } from "@/components/app";
import { usePlatform } from "@/hooks";
import { useViewStore } from "@/stores";
import { cn } from "@/lib/utils";

interface MainLayoutProps {
  leftSidebar: ReactNode;
  rightSidebar: ReactNode;
  mainContent: ReactNode;
}

// 动画过渡样式
const TRANSITION_STYLE = "flex-grow 0.25s cubic-bezier(0.32, 0.72, 0, 1)";

export function MainLayout({ leftSidebar, rightSidebar, mainContent }: MainLayoutProps) {
  const { isMac, isWindows } = usePlatform();
  const showFolderSidebar = useViewStore((state) => state.showFolderSidebar);
  const setShowFolderSidebar = useViewStore((state) => state.setShowFolderSidebar);
  const toggleFolderSidebar = useViewStore((state) => state.toggleFolderSidebar);
  const isNoteSearchExpanded = useViewStore((state) => state.isNoteSearchExpanded);
  const folderPanelRef = usePanelRef();
  const notePanelRef = usePanelRef();

  // 保存笔记列表的宽度（使用 ref 避免触发 useEffect）
  const noteListSizeRef = useRef(25);

  // 面板外层元素的 ref（用于设置过渡动画）
  const folderPanelElementRef = useRef<HTMLDivElement | null>(null);
  const notePanelElementRef = useRef<HTMLDivElement | null>(null);
  const mainPanelElementRef = useRef<HTMLDivElement | null>(null);

  // 标记是否是编程触发的变化（用于区分拖拽和按钮点击）
  const isProgrammaticRef = useRef(false);

  // 按钮是否应该显示：文件夹展开时显示，或者文件夹收起但搜索未展开时显示
  const shouldShowToggleButton = showFolderSidebar || !isNoteSearchExpanded;

  // 设置过渡动画
  const enableTransitions = () => {
    [folderPanelElementRef, notePanelElementRef, mainPanelElementRef].forEach((ref) => {
      if (ref.current) ref.current.style.transition = TRANSITION_STYLE;
    });
  };

  // 移除过渡动画
  const disableTransitions = () => {
    [folderPanelElementRef, notePanelElementRef, mainPanelElementRef].forEach((ref) => {
      if (ref.current) ref.current.style.transition = "";
    });
  };

  // 使用 collapse/expand API 控制面板（只在 showFolderSidebar 变化时触发）
  useEffect(() => {
    const folderPanel = folderPanelRef.current;
    const notePanel = notePanelRef.current;
    if (!folderPanel || !notePanel) return;

    // 标记为编程触发，启用动画
    isProgrammaticRef.current = true;
    enableTransitions();

    if (showFolderSidebar) {
      folderPanel.expand();
      notePanel.resize(`${noteListSizeRef.current}%`);
    } else {
      folderPanel.collapse();
      notePanel.resize(`${noteListSizeRef.current}%`);
    }

    // 动画结束后移除过渡样式
    const timer = setTimeout(() => {
      disableTransitions();
      isProgrammaticRef.current = false;
    }, 300);

    return () => clearTimeout(timer);
  }, [showFolderSidebar, folderPanelRef, notePanelRef]);

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

  // 分割线 pointerdown 事件处理 - 确保拖拽时没有动画
  const handlePointerDown = () => {
    disableTransitions();
  };

  return (
    <div className="bg-background flex h-screen w-full overflow-hidden" style={outerStyle}>
      {/* 自定义标题栏（Windows 拖拽区域） */}
      <TitleBar />

      {/* 固定的文件夹切换按钮 - 文件夹收起且搜索展开时隐藏 */}
      {shouldShowToggleButton && (
        <Button
          variant="ghost"
          size="sm"
          className="absolute z-10 h-7 w-7 shrink-0 p-0 transition-opacity duration-200"
          style={{
            top: isMac
              ? "calc(var(--titlebar-height-mac) + 12px)"
              : isWindows
                ? "calc(var(--titlebar-height-windows) + 13px)"
                : "12px",
            left: "12px"
          }}
          onClick={toggleFolderSidebar}
        >
          {showFolderSidebar ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
        </Button>
      )}

      <ResizablePanelGroup
        orientation="horizontal"
        className={cn("h-full", isWindows && "border-border border-t")}
        style={innerStyle}
      >
        {/* 左侧文件夹树 - 使用 collapsible */}
        <ResizablePanel
          panelRef={folderPanelRef}
          elementRef={folderPanelElementRef}
          defaultSize="15%"
          minSize="10%"
          maxSize="20%"
          collapsible={true}
          collapsedSize="0%"
          onResize={(size: PanelSize) => {
            // 只在非编程触发时同步状态（即用户拖拽时）
            if (!isProgrammaticRef.current) {
              const isCollapsed = size.asPercentage === 0;
              if (isCollapsed && showFolderSidebar) {
                setShowFolderSidebar(false);
              } else if (!isCollapsed && !showFolderSidebar) {
                setShowFolderSidebar(true);
              }
            }
          }}
          className="bg-background overflow-hidden"
        >
          <aside className="no-select h-full">{leftSidebar}</aside>
        </ResizablePanel>

        {/* 分割线 */}
        <ResizableHandle className={handleClassName} style={handleStyle} onPointerDown={handlePointerDown} />

        {/* 中间笔记列表 - 保存并恢复宽度 */}
        <ResizablePanel
          panelRef={notePanelRef}
          elementRef={notePanelElementRef}
          defaultSize="25%"
          minSize="20%"
          maxSize="35%"
          onResize={(size: PanelSize) => {
            // 保存笔记列表的宽度到 ref（不触发重渲染）
            noteListSizeRef.current = size.asPercentage;
          }}
          className="bg-background"
        >
          <aside className="no-select h-full">{rightSidebar}</aside>
        </ResizablePanel>

        {/* 分割线 */}
        <ResizableHandle className={handleClassName} style={handleStyle} onPointerDown={handlePointerDown} />

        {/* 右侧编辑区 - 自动填充剩余空间 */}
        <ResizablePanel elementRef={mainPanelElementRef} className="bg-background">
          <main className="allow-select h-full min-w-0 overflow-hidden">{mainContent}</main>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
