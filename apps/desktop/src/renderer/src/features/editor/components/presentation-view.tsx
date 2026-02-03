import { useEffect, useCallback } from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useViewStore, useNoteStore } from "@/stores";
import { MarkdownRenderer } from "./markdown-renderer";

/**
 * 演示模式视图
 * 全屏展示预览内容，按 ESC 或点击关闭按钮退出
 * 进入时自动调用 Electron 全屏 API
 */
export function PresentationView() {
  const isPresentationMode = useViewStore((state) => state.isPresentationMode);
  const exitPresentationMode = useViewStore((state) => state.exitPresentationMode);
  const editorContent = useNoteStore((state) => state.editorContent);
  const selectedNote = useNoteStore((state) => state.getSelectedNote());

  // 监听 ESC 键退出
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && isPresentationMode) {
        // 移除焦点，避免退出后按钮显示 focus 状态
        (document.activeElement as HTMLElement)?.blur();
        exitPresentationMode();
      }
    },
    [isPresentationMode, exitPresentationMode]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // 进入/退出演示模式时控制 Electron 全屏
  useEffect(() => {
    const setFullScreen = async (fullScreen: boolean) => {
      const result = await window.api.window.setFullScreen(fullScreen);
      if (!result.ok) {
        console.error("设置全屏失败:", result.error.message);
      }
    };

    setFullScreen(isPresentationMode);
  }, [isPresentationMode]);

  return (
    <AnimatePresence>
      {isPresentationMode && (
        <motion.div
          className="bg-background fixed inset-0 z-50 flex flex-col"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* 顶部工具栏 - 悬浮显示 */}
          <motion.div
            className="absolute top-4 right-4 z-10"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Button
              variant="ghost"
              size="sm"
              className="bg-background/80 hover:bg-background h-10 w-10 rounded-full p-0 backdrop-blur-sm"
              onClick={exitPresentationMode}
            >
              <X className="h-5 w-5" />
            </Button>
          </motion.div>

          {/* 内容区域 */}
          <ScrollArea className="h-full flex-1">
            <motion.div
              className="p-16"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <MarkdownRenderer content={editorContent} notePath={selectedNote?.filePath} className="max-w-none" />
            </motion.div>
          </ScrollArea>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
