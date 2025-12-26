import { useEffect } from "react";
import { NotePage } from "@/pages/note";
import { useThemeStore } from "@/stores/use-theme-store";
import { Toaster } from "@/components/ui/sonner";

function App(): React.JSX.Element {
  const initTheme = useThemeStore((state) => state.initTheme);

  // 初始化主题
  useEffect(() => {
    initTheme();
  }, [initTheme]);

  return (
    <>
      <NotePage />
      <Toaster position="bottom-right" />
    </>
  );
}

export default App;
