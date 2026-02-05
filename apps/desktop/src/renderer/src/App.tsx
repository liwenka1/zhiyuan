import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { NoteWorkspace } from "@/features/note-workspace";
import { useThemeStore, useViewStore } from "@/stores";
import { Toaster } from "@/components/ui/sonner";
import { PresentationView } from "@/features/editor";

function App(): React.JSX.Element {
  const initTheme = useThemeStore((state) => state.initTheme);
  const cleanup = useThemeStore((state) => state.cleanup);
  const isPresentationMode = useViewStore((state) => state.isPresentationMode);
  const [showPresentation, setShowPresentation] = useState(false);

  // 初始化主题，组件卸载时清理监听器
  useEffect(() => {
    initTheme();
    return () => {
      cleanup();
    };
  }, [initTheme, cleanup]);

  // 阻止 Electron 默认的文件拖放导航行为
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
    };
    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
    };

    document.addEventListener("dragover", handleDragOver);
    document.addEventListener("drop", handleDrop);

    return () => {
      document.removeEventListener("dragover", handleDragOver);
      document.removeEventListener("drop", handleDrop);
    };
  }, []);

  return (
    <>
      {/* 工作区：进入演示模式时淡出，退出时淡入 */}
      <motion.div
        animate={{ opacity: isPresentationMode ? 0 : 1 }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        onAnimationComplete={() => {
          // 动画完成时同步 showPresentation 状态
          // 进入演示模式（淡出完成）-> 显示演示视图
          // 退出演示模式（淡入完成）-> 隐藏演示视图
          setShowPresentation(isPresentationMode);
        }}
        style={{ pointerEvents: isPresentationMode ? "none" : "auto" }}
      >
        <NoteWorkspace />
      </motion.div>

      {/* 演示视图：延迟显示，退出时自动淡出 */}
      <AnimatePresence>{showPresentation && <PresentationView />}</AnimatePresence>

      <Toaster position="bottom-right" />
    </>
  );
}

export default App;
