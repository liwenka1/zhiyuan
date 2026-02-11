/**
 * 共享模块统一导出
 * 供主进程、渲染进程和 preload 使用
 */

export type { Theme, ThemeMode } from "./theme";
export { ThemeColors, getThemeBackgroundColor, getThemeForegroundColor } from "./theme";
export type { ExportLayoutConfig } from "./export-layout";
export { DEFAULT_EXPORT_LAYOUT_CONFIG, normalizeExportLayoutConfig } from "./export-layout";

export type { IpcError, IpcResultDTO } from "./ipc";

export type {
  MenuLocale,
  MenuAction,
  MenuShortcut,
  MenuLabel,
  MenuItemDef,
  MenuSeparatorDef,
  MenuEntryDef,
  MenuGroupDef
} from "./menu";
export { menuSchema, resolveLabel, toElectronAccelerator, isMenuItem } from "./menu";
