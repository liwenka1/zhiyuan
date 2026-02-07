import { type CSSProperties } from "react";
import { usePlatform } from "@/hooks";
import { AppMenuBar } from "./app-menu-bar";

interface ElectronCSSProperties extends CSSProperties {
  WebkitAppRegion?: "drag" | "no-drag";
}

/**
 * 自定义标题栏组件
 * Windows 平台渲染自定义菜单栏（含 Logo + 菜单）
 * macOS 平台渲染透明拖拽区域
 */
export function TitleBar() {
  const { isMac, isWindows } = usePlatform();

  if (isMac) {
    return (
      <div
        className="fixed inset-x-0 top-0 z-9999"
        style={
          {
            height: "var(--titlebar-height-mac)",
            WebkitAppRegion: "drag"
          } as ElectronCSSProperties
        }
      />
    );
  }

  if (isWindows) {
    return <AppMenuBar />;
  }

  return null;
}
