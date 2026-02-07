import { ipcRenderer } from "electron";
import type { Theme, ThemeMode, IpcResultDTO } from "@shared";

export const themeApi = {
  /**
   * 获取当前实际生效的主题（light / dark）
   */
  get: (): Promise<IpcResultDTO<Theme>> => ipcRenderer.invoke("theme:get"),

  /**
   * 获取用户设置的主题模式（light / dark / system）
   */
  getMode: (): Promise<IpcResultDTO<ThemeMode>> => ipcRenderer.invoke("theme:getMode"),

  /**
   * 设置主题模式
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
