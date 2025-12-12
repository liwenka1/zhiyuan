import { useEffect } from "react";
import { NotePage } from "@/pages/note";
import { useThemeStore } from "@/stores/use-theme-store";

function App(): React.JSX.Element {
  const initTheme = useThemeStore((state) => state.initTheme);

  // 初始化主题
  useEffect(() => {
    initTheme();
  }, [initTheme]);

  return <NotePage />;
}

export default App;
