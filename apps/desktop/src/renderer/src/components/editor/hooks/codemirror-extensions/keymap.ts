import { keymap } from "@codemirror/view";
import type { Extension } from "@codemirror/state";

/**
 * 创建自定义快捷键的 keymap
 * 覆盖 CodeMirror 的内置搜索快捷键，使用应用自定义的搜索功能
 */
export function createCustomKeymapExtension(onOpenSearch?: () => void): Extension {
  // 创建一个通用的处理器，返回 true 表示已处理事件，阻止默认行为
  const disableHandler = () => true;

  return keymap.of([
    // 搜索快捷键 (Cmd+F / Ctrl+F) - 触发自定义搜索
    {
      key: "Mod-f",
      run: () => {
        onOpenSearch?.();
        return true;
      }
    },
    // 禁用替换快捷键 (Cmd+H / Ctrl+H)
    { key: "Mod-h", run: disableHandler },
    // 禁用查找下一个 (Cmd+G / Ctrl+G)
    { key: "Mod-g", run: disableHandler },
    // 禁用查找上一个 (Shift+Cmd+G / Shift+Ctrl+G)
    { key: "Shift-Mod-g", run: disableHandler },
    // 禁用选择所有匹配项 (Cmd+Shift+L / Ctrl+Shift+L)
    { key: "Shift-Mod-l", run: disableHandler },
    // 禁用 Alt+G (跳转到行)
    { key: "Alt-g", run: disableHandler }
  ]);
}
