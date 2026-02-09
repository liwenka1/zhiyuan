/**
 * 导出主题预设聚合
 * 新增主题：创建文件 → 在此导入并添加到数组 → 添加 i18n key
 */

import type { ExportThemePreset, ThemeColors } from "../theme-colors";
import { defaultTheme } from "./default";
import { techBlueTheme } from "./tech-blue";
import { warmOrangeTheme } from "./warm-orange";
import { elegantPurpleTheme } from "./elegant-purple";
import { forestGreenTheme } from "./forest-green";

/** 所有导出主题预设（使用 as const 保留字面量 id 类型） */
const _PRESETS = [defaultTheme, techBlueTheme, warmOrangeTheme, elegantPurpleTheme, forestGreenTheme] as const;

/** 导出主题 ID 联合类型 */
export type ExportThemeId = (typeof _PRESETS)[number]["id"];

/** 可变引用，供外部遍历使用 */
export const EXPORT_THEME_PRESETS: readonly ExportThemePreset[] = _PRESETS;

/** 默认导出主题 ID */
export const DEFAULT_EXPORT_THEME_ID: ExportThemeId = "default";

const _defaultPreset = _PRESETS.find((p) => p.id === DEFAULT_EXPORT_THEME_ID) ?? _PRESETS[0];

/**
 * 校验并解析导出主题 ID，无效值 fallback 到默认主题
 */
export function resolveExportThemeId(themeId?: string): ExportThemeId {
  if (!themeId) return DEFAULT_EXPORT_THEME_ID;
  const preset = _PRESETS.find((p) => p.id === themeId);
  return preset ? (preset.id as ExportThemeId) : DEFAULT_EXPORT_THEME_ID;
}

/**
 * 根据导出主题 ID 获取颜色
 *
 * 返回预设数组中的原始引用（非拷贝），使 React.memo / useMemo 的引用比较能正常工作。
 */
export function getExportThemeColors(themeId: string): ThemeColors {
  const preset = _PRESETS.find((p) => p.id === themeId);
  return preset ? preset.colors : _defaultPreset.colors;
}
