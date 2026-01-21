import { useEffect } from "react";
import { NotePage } from "@/pages/note";
import { useThemeStore } from "@/stores";
import { Toaster } from "@/components/ui/sonner";
import { PresentationView } from "@/components/editor/presentation-view";

function App(): React.JSX.Element {
  const initTheme = useThemeStore((state) => state.initTheme);

  // 初始化主题
  useEffect(() => {
    initTheme();
  }, [initTheme]);

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
      <NotePage />
      <PresentationView />
      <Toaster position="bottom-right" />
    </>
  );
}

export default App;
