import { CSSProperties } from "react";
import { usePlatform } from "@/hooks";

/**
 * 扩展 CSSProperties 以支持 Electron 的 WebkitAppRegion
 */
interface ElectronCSSProperties extends CSSProperties {
  WebkitAppRegion?: "drag" | "no-drag";
}

/**
 * 自定义标题栏组件
 * 用于 Windows 平台的拖拽区域
 */
export function TitleBar() {
  const { isWindows } = usePlatform();

  // 非 Windows 系统不渲染
  if (!isWindows) {
    return null;
  }

  const titleBarStyle: ElectronCSSProperties = {
    height: "var(--titlebar-height-windows)",
    WebkitAppRegion: "drag"
  };

  return (
    <div
      data-titlebar
      className="bg-background pointer-events-none fixed inset-x-0 top-0 z-9999"
      style={titleBarStyle}
    />
  );
}
