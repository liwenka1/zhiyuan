/**
 * 主题颜色配置
 * 管理导出预设的颜色方案
 *
 * 预设列表及查找函数定义在 ./themes/index.ts 中，
 * 外部统一从 styles/index.ts 或 ./themes 导入。
 */

/**
 * 主题颜色配置接口
 *
 * 分为「基础色」和「语义色」两部分：
 * - 基础色：背景、前景、边框等通用色值
 * - 语义色：标题装饰、引用块、代码块等场景化色值
 *
 * 每个预设只需定义「基础色」，「语义色」会自动从基础色派生。
 * 如需覆盖某个语义色，在预设中显式指定即可。
 * 参见 {@link buildThemeColors}
 */
export interface ThemeColors {
  /* ---- 基础色 ---- */
  background: string;
  foreground: string;
  muted: string;
  mutedForeground: string;
  border: string;
  headingColor: string;
  linkColor: string;
  listMarker: string;
  strongColor: string;
  emphasisColor: string;
  codeColor: string;
  codeBg: string;
  quoteColor: string;
  hrColor: string;
  tagColor: string;
  metaColor: string;
  markBg: string;
  codeBlockBg: string;

  /* ---- 语义色（可从基础色自动派生） ---- */
  /** h1 标题颜色，默认同 headingColor */
  h1Color: string;
  /** h2 标题颜色，默认同 headingColor */
  h2Color: string;
  /** h1 装饰色（border-bottom），默认同 border */
  h1Decoration: string;
  /** h2 装饰色（border-left），默认同 border */
  h2Decoration: string;
  /** 加粗文字背景色，"transparent" 表示无背景 */
  strongBg: string;
  /** 引用块边框色，默认同 border */
  blockquoteBorder: string;
  /** 引用块背景色，默认同 muted */
  blockquoteBg: string;
  /** 代码块文字色，默认同 foreground */
  codeBlockColor: string;
  /** 代码块边框色，默认同 border */
  codeBlockBorder: string;
  /** 表头背景色，默认同 muted */
  tableTh: string;
  /** 表头文字色，默认同 foreground */
  tableThColor: string;
}

/** 语义色 key（可由基础色自动派生） */
type SemanticKeys =
  | "h1Color"
  | "h2Color"
  | "h1Decoration"
  | "h2Decoration"
  | "strongBg"
  | "blockquoteBorder"
  | "blockquoteBg"
  | "codeBlockColor"
  | "codeBlockBorder"
  | "tableTh"
  | "tableThColor";

/** buildThemeColors 的入参类型：基础色必填 + 语义色可选覆盖 */
export type ThemeColorsInput = Omit<ThemeColors, SemanticKeys> & Partial<Pick<ThemeColors, SemanticKeys>>;

/**
 * 构建完整的 ThemeColors —— 语义色自动从基础色派生
 *
 * 主题预设只需提供基础色和需要覆盖的语义色，其余自动填充。
 * @param base 基础色 + 可选的语义色覆盖
 */
export function buildThemeColors(base: ThemeColorsInput): ThemeColors {
  return {
    ...base,
    h1Color: base.h1Color ?? base.headingColor,
    h2Color: base.h2Color ?? base.headingColor,
    h1Decoration: base.h1Decoration ?? base.border,
    h2Decoration: base.h2Decoration ?? base.border,
    strongBg: base.strongBg ?? "transparent",
    blockquoteBorder: base.blockquoteBorder ?? base.border,
    blockquoteBg: base.blockquoteBg ?? base.muted,
    codeBlockColor: base.codeBlockColor ?? base.foreground,
    codeBlockBorder: base.codeBlockBorder ?? base.border,
    tableTh: base.tableTh ?? base.muted,
    tableThColor: base.tableThColor ?? base.foreground
  };
}

/** 导出主题预设，主题名称通过 i18n 获取（key: settings.exportThemes.${id}） */
export interface ExportThemePreset {
  id: string;
  colors: ThemeColors;
}
