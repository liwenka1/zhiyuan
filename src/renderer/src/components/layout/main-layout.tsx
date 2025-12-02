import { ReactNode } from "react";

interface MainLayoutProps {
  leftSidebar: ReactNode;
  rightSidebar: ReactNode;
  mainContent: ReactNode;
}

export function MainLayout({ leftSidebar, rightSidebar, mainContent }: MainLayoutProps) {
  return (
    <div className="bg-background flex h-screen w-full overflow-hidden">
      {/* 左侧文件夹树 */}
      <aside className="border-border bg-card w-48 min-w-[160px] shrink-0 border-r">{leftSidebar}</aside>

      {/* 中间笔记列表 */}
      <aside className="border-border bg-card w-56 min-w-[192px] shrink-0 border-r">{rightSidebar}</aside>

      {/* 右侧编辑区 */}
      <main className="min-w-0 flex-1 overflow-hidden">{mainContent}</main>
    </div>
  );
}
