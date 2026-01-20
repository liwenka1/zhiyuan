import { useEffect, useCallback, CSSProperties } from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useViewStore, useNoteStore } from "@/stores";
import { createUrlTransformer } from "@/lib/resource-resolver";
import { usePlatform } from "@/components/titlebar/use-platform";
import { cn } from "@/lib/utils";

/**
 * 演示模式视图
 * 全屏展示预览内容，按 ESC 或点击关闭按钮退出
 */
export function PresentationView() {
  const isPresentationMode = useViewStore((state) => state.isPresentationMode);
  const exitPresentationMode = useViewStore((state) => state.exitPresentationMode);
  const editorContent = useNoteStore((state) => state.editorContent);
  const selectedNote = useNoteStore((state) => state.getSelectedNote());
  const { isWindows, isMac } = usePlatform();

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

  // 创建 URL 转换函数
  const urlTransform = createUrlTransformer(selectedNote?.filePath);

  // Windows 系统下需要预留 titlebar 的空间并添加顶部边框
  const containerStyle: CSSProperties = isWindows
    ? { top: "calc(var(--titlebar-height-windows) + 1px)" }
    : isMac
      ? { top: "var(--titlebar-height-mac)" } // macOS 也要留空间
      : {};

  return (
    <AnimatePresence>
      {isPresentationMode && (
        <motion.div
          className={cn("bg-background fixed inset-0 z-50 flex flex-col", isWindows && "border-border border-t")}
          style={containerStyle}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* 顶部工具栏 - 悬浮显示，与编辑器工具栏对齐 (h-12 = 48px, 按钮 h-8 = 32px) */}
          <motion.div
            className="absolute top-0 right-0 z-10 flex h-12 items-center px-3"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Button
              variant="ghost"
              size="sm"
              className="bg-background/80 hover:bg-background h-8 w-8 rounded-full p-0 backdrop-blur-sm"
              onClick={exitPresentationMode}
            >
              <X className="h-4 w-4" />
            </Button>
          </motion.div>

          {/* 内容区域 */}
          <ScrollArea className="h-full flex-1">
            <motion.div
              className="prose prose-slate dark:prose-invert mx-auto max-w-4xl px-8 py-16"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.3 }}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} urlTransform={urlTransform}>
                {editorContent}
              </ReactMarkdown>
            </motion.div>
          </ScrollArea>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
