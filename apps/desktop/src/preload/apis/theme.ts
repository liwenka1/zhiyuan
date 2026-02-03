import { ipcRenderer } from "electron";
import type { Theme, ThemeMode, IpcResultDTO } from "@shared";

export const themeApi = {
  /**
   * 获取当前主题
   */
  get: (): Promise<IpcResultDTO<Theme>> => ipcRenderer.invoke("theme:get"),

  /**
   * 设置主题
   */
  set: (theme: ThemeMode): Promise<IpcResultDTO<void>> => ipcRenderer.invoke("theme:set", theme),

  /**
   * 监听主题变化（系统主题或用户设置变化）
   */
  onChanged: (callback: (theme: Theme) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, theme: Theme) => {
      callback(theme);
    };
    ipcRenderer.on("theme:changed", listener);

    // 返回取消监听函数
    return () => {
      ipcRenderer.removeListener("theme:changed", listener);
    };
  }
};
