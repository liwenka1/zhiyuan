import { ReactNode } from "react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { TitleBar } from "@/components/titlebar";
import { usePlatform } from "@/components/titlebar/use-platform";

interface MainLayoutProps {
  leftSidebar: ReactNode;
  rightSidebar: ReactNode;
  mainContent: ReactNode;
}

export function MainLayout({ leftSidebar, rightSidebar, mainContent }: MainLayoutProps) {
  const { isMac, isWindows } = usePlatform();

  // 根据平台设置标题栏高度
  const getTitleBarHeight = () => {
    if (isMac) return "var(--titlebar-height-mac)";
    if (isWindows) return "var(--titlebar-height-windows)";
    return "0px";
  };

  return (
    <div
      className="bg-background flex h-screen w-full overflow-hidden"
      style={{
        paddingTop: getTitleBarHeight()
      }}
    >
      {/* 自定义标题栏（Windows 拖拽区域） */}
      <TitleBar />
      <ResizablePanelGroup direction="horizontal" className={`h-full ${isWindows ? "border-border border-t" : ""}`}>
        {/* 左侧文件夹树 */}
        <ResizablePanel defaultSize={15} minSize={15} maxSize={20} className="bg-card">
          <aside className="no-select h-full">{leftSidebar}</aside>
        </ResizablePanel>

        {/* 分割线 */}
        <ResizableHandle className="bg-divider hover:bg-highlight/50 w-px transition-colors duration-150" />

        {/* 中间笔记列表 */}
        <ResizablePanel defaultSize={25} minSize={20} maxSize={35} className="bg-card">
          <aside className="no-select h-full">{rightSidebar}</aside>
        </ResizablePanel>

        {/* 分割线 */}
        <ResizableHandle className="bg-divider hover:bg-highlight/50 w-px transition-colors duration-150" />

        {/* 右侧编辑区 */}
        <ResizablePanel defaultSize={60} className="bg-background">
          <main className="allow-select h-full min-w-0 overflow-hidden">{mainContent}</main>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
