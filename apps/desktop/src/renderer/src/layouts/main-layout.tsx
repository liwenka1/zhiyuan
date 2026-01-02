import { ReactNode, CSSProperties } from "react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { TitleBar } from "@/components/titlebar";
import { usePlatform } from "@/components/titlebar/use-platform";
import { cn } from "@/lib/utils";

interface MainLayoutProps {
  leftSidebar: ReactNode;
  rightSidebar: ReactNode;
  mainContent: ReactNode;
}

export function MainLayout({ leftSidebar, rightSidebar, mainContent }: MainLayoutProps) {
  const { isMac, isWindows } = usePlatform();

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
      <ResizablePanelGroup
        direction="horizontal"
        className={cn("h-full", isWindows && "border-border border-t")}
        style={innerStyle}
      >
        {/* 左侧文件夹树 */}
        <ResizablePanel defaultSize={15} minSize={15} maxSize={20} className="bg-background">
          <aside className="no-select h-full">{leftSidebar}</aside>
        </ResizablePanel>

        {/* 分割线 */}
        <ResizableHandle className={handleClassName} style={handleStyle} />

        {/* 中间笔记列表 */}
        <ResizablePanel defaultSize={25} minSize={20} maxSize={35} className="bg-background">
          <aside className="no-select h-full">{rightSidebar}</aside>
        </ResizablePanel>

        {/* 分割线 */}
        <ResizableHandle className={handleClassName} style={handleStyle} />

        {/* 右侧编辑区 */}
        <ResizablePanel defaultSize={60} className="bg-background">
          <main className="allow-select h-full min-w-0 overflow-hidden">{mainContent}</main>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
