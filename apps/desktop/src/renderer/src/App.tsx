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

  return (
    <>
      <NotePage />
      <PresentationView />
      <Toaster position="bottom-right" />
    </>
  );
}

export default App;
