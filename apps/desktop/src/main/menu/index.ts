import { Menu, app } from "electron";

/**
 * 创建应用菜单
 *
 * - macOS: 设置最小化菜单，保留系统快捷键（Cmd+Q、Cmd+C/V 等）
 *   顶层菜单名和 submenu label 根据系统语言设置中/英文
 * - Windows/Linux: 移除默认菜单（快捷键通过 webContents 处理）
 */
export function setupApplicationMenu(): void {
  if (process.platform === "darwin") {
    const isZh = app.getLocale().startsWith("zh");

    const template: Electron.MenuItemConstructorOptions[] = [
      {
        label: app.name,
        submenu: [
          { role: "about", label: isZh ? `关于 ${app.name}` : `About ${app.name}` },
          { type: "separator" },
          { role: "hide", label: isZh ? `隐藏 ${app.name}` : `Hide ${app.name}` },
          { type: "separator" },
          { role: "quit", label: isZh ? `退出 ${app.name}` : `Quit ${app.name}` }
        ]
      },
      {
        label: isZh ? "编辑" : "Edit",
        submenu: [
          { role: "undo", label: isZh ? "撤销" : "Undo" },
          { role: "redo", label: isZh ? "重做" : "Redo" },
          { type: "separator" },
          { role: "cut", label: isZh ? "剪切" : "Cut" },
          { role: "copy", label: isZh ? "拷贝" : "Copy" },
          { role: "paste", label: isZh ? "粘贴" : "Paste" },
          { role: "selectAll", label: isZh ? "全选" : "Select All" }
        ]
      }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  } else {
    // Windows / Linux: 移除默认菜单
    // 编辑快捷键（Ctrl+C/V/X 等）在 webContents 中正常工作
    Menu.setApplicationMenu(null);
  }
}
