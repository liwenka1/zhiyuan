import { usePlatform } from "@/hooks";
import { AppMenuBar } from "./app-menu-bar";

/**
 * 自定义标题栏组件
 * Windows 平台渲染自定义菜单栏（含 Logo + 菜单）
 * macOS 平台不渲染（由系统提供标题栏）
 */
export function TitleBar() {
  const { isWindows } = usePlatform();

  if (!isWindows) {
    return null;
  }

  return <AppMenuBar />;
}
