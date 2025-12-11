import { ReactNode } from "react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";

interface MainLayoutProps {
  leftSidebar: ReactNode;
  rightSidebar: ReactNode;
  mainContent: ReactNode;
}

export function MainLayout({ leftSidebar, rightSidebar, mainContent }: MainLayoutProps) {
  return (
    <div className="bg-background flex h-screen w-full overflow-hidden">
      <ResizablePanelGroup direction="horizontal" className="h-full">
        {/* 左侧文件夹树 */}
        <ResizablePanel defaultSize={12} minSize={10} maxSize={20} className="bg-card">
          <aside className="no-select h-full">{leftSidebar}</aside>
        </ResizablePanel>

        {/* 分割线 */}
        <ResizableHandle className="bg-divider hover:bg-highlight/50 w-px transition-colors duration-150" />

        {/* 中间笔记列表 */}
        <ResizablePanel defaultSize={22} minSize={15} maxSize={35} className="bg-card">
          <aside className="no-select h-full">{rightSidebar}</aside>
        </ResizablePanel>

        {/* 分割线 */}
        <ResizableHandle className="bg-divider hover:bg-highlight/50 w-px transition-colors duration-150" />

        {/* 右侧编辑区 */}
        <ResizablePanel defaultSize={66} className="bg-background">
          <main className="allow-select h-full min-w-0 overflow-hidden">{mainContent}</main>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
