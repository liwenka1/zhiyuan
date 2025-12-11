import { useEffect } from "react";
import { useNoteStore } from "@/stores/use-note-store";
import { useViewStore } from "@/stores/use-view-store";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

/**
 * 幻灯片演示模式
 */
export function PresentationMode() {
  const editorContent = useNoteStore((state) => state.editorContent);
  const presentationConfig = useViewStore((state) => state.presentationConfig);
  const setViewMode = useViewStore((state) => state.setViewMode);
  const nextSlide = useViewStore((state) => state.nextSlide);
  const prevSlide = useViewStore((state) => state.prevSlide);

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowRight":
        case " ": // 空格
          e.preventDefault();
          nextSlide();
          break;
        case "ArrowLeft":
          e.preventDefault();
          prevSlide();
          break;
        case "Escape":
          setViewMode("note");
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [nextSlide, prevSlide, setViewMode]);

  const { currentSlide, totalSlides } = presentationConfig;

  // 临时占位 UI
  return (
    <div className="bg-background relative flex h-screen flex-col items-center justify-center">
      {/* 退出按钮 */}
      <button
        onClick={() => setViewMode("note")}
        className="hover:bg-muted absolute top-4 right-4 rounded-full p-2 transition-colors"
        aria-label="退出演示"
      >
        <X className="h-5 w-5" />
      </button>

      {/* 主内容区 */}
      <div className="flex max-w-4xl flex-col items-center space-y-8 px-8 text-center">
        <h1 className="text-foreground text-5xl font-bold">幻灯片演示模式</h1>
        <p className="text-muted-foreground text-xl">
          按 <kbd className="bg-muted rounded px-2 py-1 font-mono text-sm">←</kbd> /{" "}
          <kbd className="bg-muted rounded px-2 py-1 font-mono text-sm">→</kbd> 切换幻灯片 按{" "}
          <kbd className="bg-muted rounded px-2 py-1 font-mono text-sm">Esc</kbd> 退出演示
        </p>

        <div className="bg-card rounded-lg p-6 text-left">
          <div className="space-y-2 text-sm">
            <div>当前幻灯片: {currentSlide + 1}</div>
            <div>总幻灯片数: {totalSlides}</div>
            <div>自动播放: {presentationConfig.autoPlay ? "开启" : "关闭"}</div>
            <div className="text-muted-foreground mt-4 text-xs">内容长度: {editorContent.length} 字符</div>
          </div>
        </div>
      </div>

      {/* 底部导航 */}
      <div className="absolute bottom-8 flex items-center gap-4">
        <button
          onClick={prevSlide}
          disabled={currentSlide === 0}
          className="hover:bg-muted rounded-full p-2 transition-colors disabled:opacity-30"
          aria-label="上一张"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>

        <div className="text-muted-foreground text-sm">
          {currentSlide + 1} / {totalSlides || 1}
        </div>

        <button
          onClick={nextSlide}
          disabled={currentSlide >= totalSlides - 1}
          className="hover:bg-muted rounded-full p-2 transition-colors disabled:opacity-30"
          aria-label="下一张"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      </div>

      {/* 进度条 */}
      <div className="bg-muted absolute bottom-0 left-0 h-1 w-full">
        <div
          className="bg-primary h-full transition-all duration-300"
          style={{
            width: totalSlides > 0 ? `${((currentSlide + 1) / totalSlides) * 100}%` : "0%"
          }}
        />
      </div>
    </div>
  );
}
