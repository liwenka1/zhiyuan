/**
 * 共享模块统一导出
 * 供主进程、渲染进程和 preload 使用
 */

export type { Theme, ThemeMode } from "./theme";
export { ThemeColors, getThemeBackgroundColor, getThemeForegroundColor } from "./theme";

export type { IpcError, IpcResultDTO } from "./ipc";
