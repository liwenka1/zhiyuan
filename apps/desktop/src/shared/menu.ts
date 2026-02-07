/**
 * 共享菜单结构定义
 * 供主进程（macOS 原生菜单）和渲染进程（Windows 自定义菜单栏）使用
 *
 * 纯数据，不依赖 Electron / React
 */

/* ---------- 类型定义 ---------- */

/** 支持的语言 */
export type MenuLocale = "zh" | "en";

/** 菜单项动作标识 */
export type MenuAction =
  | "newWindow"
  | "openFolder"
  | "openFile"
  | "undo"
  | "redo"
  | "cut"
  | "copy"
  | "paste"
  | "selectAll";

/** 平台快捷键 */
export interface MenuShortcut {
  mac: string;
  win: string;
}

/** 多语言标签 */
export type MenuLabel = Record<MenuLocale, string>;

/** 普通菜单项 */
export interface MenuItemDef {
  type?: "item";
  id: MenuAction;
  label: MenuLabel;
  shortcut?: MenuShortcut;
  /** Electron 原生菜单 role（macOS 编辑菜单） */
  role?: string;
}

/** 分割线 */
export interface MenuSeparatorDef {
  type: "separator";
}

/** 菜单项（含分割线） */
export type MenuEntryDef = MenuItemDef | MenuSeparatorDef;

/** 顶级菜单 */
export interface MenuGroupDef {
  id: string;
  label: MenuLabel;
  items: MenuEntryDef[];
}

/* ---------- 菜单结构（唯一真相源） ---------- */

export const menuSchema: MenuGroupDef[] = [
  {
    id: "file",
    label: { zh: "文件", en: "File" },
    items: [
      { id: "newWindow", label: { zh: "新建窗口", en: "New Window" } },
      { type: "separator" },
      { id: "openFile", label: { zh: "打开文件…", en: "Open File…" }, shortcut: { mac: "Cmd+O", win: "Ctrl+O" } },
      {
        id: "openFolder",
        label: { zh: "打开文件夹…", en: "Open Folder…" }
      }
    ]
  },
  {
    id: "edit",
    label: { zh: "编辑", en: "Edit" },
    items: [
      { id: "undo", label: { zh: "撤销", en: "Undo" }, shortcut: { mac: "Cmd+Z", win: "Ctrl+Z" }, role: "undo" },
      { id: "redo", label: { zh: "重做", en: "Redo" }, shortcut: { mac: "Cmd+Y", win: "Ctrl+Y" }, role: "redo" },
      { type: "separator" },
      { id: "cut", label: { zh: "剪切", en: "Cut" }, shortcut: { mac: "Cmd+X", win: "Ctrl+X" }, role: "cut" },
      { id: "copy", label: { zh: "拷贝", en: "Copy" }, shortcut: { mac: "Cmd+C", win: "Ctrl+C" }, role: "copy" },
      { id: "paste", label: { zh: "粘贴", en: "Paste" }, shortcut: { mac: "Cmd+V", win: "Ctrl+V" }, role: "paste" },
      {
        id: "selectAll",
        label: { zh: "全选", en: "Select All" },
        shortcut: { mac: "Cmd+A", win: "Ctrl+A" },
        role: "selectAll"
      }
    ]
  }
];

/* ---------- 工具函数 ---------- */

/** 解析标签 */
export function resolveLabel(label: MenuLabel, locale: MenuLocale): string {
  return label[locale] ?? label.en;
}

/** 将快捷键转换为 Electron accelerator（Cmd → CmdOrCtrl） */
export function toElectronAccelerator(shortcut: MenuShortcut): string {
  return shortcut.mac.replace("Cmd", "CmdOrCtrl");
}

/** 判断 MenuEntryDef 是否为菜单项（非分割线） */
export function isMenuItem(entry: MenuEntryDef): entry is MenuItemDef {
  return entry.type !== "separator";
}
