import { ReactNode, useEffect, useRef } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useTranslation } from "react-i18next";
import { IconButton } from "@/components/ui/button";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle, usePanelRef } from "@/components/ui/resizable";
import type { PanelSize } from "@/components/ui/resizable";
import { useViewStore } from "@/stores";

interface MainLayoutProps {
  inert?: boolean;
  leftSidebar: ReactNode;
  rightSidebar: ReactNode;
  mainContent: ReactNode;
  mainOverlay?: ReactNode;
}

// 动画过渡样式
const TRANSITION_STYLE = "flex-grow 0.25s cubic-bezier(0.32, 0.72, 0, 1)";

export function MainLayout({ leftSidebar, rightSidebar, mainContent, mainOverlay, inert = false }: MainLayoutProps) {
  const { t } = useTranslation("common");
  const showFolderSidebar = useViewStore((state) => state.showFolderSidebar);
  const setShowFolderSidebar = useViewStore((state) => state.setShowFolderSidebar);
  const toggleFolderSidebar = useViewStore((state) => state.toggleFolderSidebar);
  const sidebarLabel = t(showFolderSidebar ? "workspace.hideFolders" : "workspace.showFolders");
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

  const handleClassName = "bg-divider hover:bg-highlight/50 w-px transition-colors duration-150";

  // 分割线 pointerdown 事件处理 - 确保拖拽时没有动画
  const handlePointerDown = () => {
    disableTransitions();
  };

  return (
    <div inert={inert} aria-busy={inert} className="bg-background relative flex h-full w-full overflow-hidden">
      <IconButton
        className="absolute top-[12px] left-[12px] z-10"
        aria-label={sidebarLabel}
        aria-expanded={showFolderSidebar}
        aria-controls="workspace-folders"
        title={sidebarLabel}
        onClick={toggleFolderSidebar}
      >
        {showFolderSidebar ? <PanelLeftClose /> : <PanelLeftOpen />}
      </IconButton>
      <ResizablePanelGroup orientation="horizontal" className="h-full">
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
          <aside id="workspace-folders" inert={!showFolderSidebar} className="no-select h-full">
            {leftSidebar}
          </aside>
        </ResizablePanel>

        {/* 分割线 */}
        <ResizableHandle className={handleClassName} onPointerDown={handlePointerDown} />

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
          className="bg-background overflow-visible"
        >
          <aside className="no-select h-full">{rightSidebar}</aside>
        </ResizablePanel>

        {/* 分割线 */}
        <ResizableHandle className={handleClassName} onPointerDown={handlePointerDown} />

        {/* 右侧编辑区 - 自动填充剩余空间 */}
        <ResizablePanel elementRef={mainPanelElementRef} className="bg-background">
          <main className="allow-select relative isolate h-full min-w-0 overflow-hidden">
            <div inert={!!mainOverlay} className="h-full overflow-hidden">
              {mainContent}
            </div>
            {mainOverlay && <div className="bg-background absolute inset-0 z-10">{mainOverlay}</div>}
          </main>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
