import { ipcRenderer } from "electron";
import type { IpcResultDTO } from "@shared";

export const windowApi = {
  /**
   * 设置窗口全屏状态
   */
  setFullScreen: (fullScreen: boolean): Promise<IpcResultDTO<void>> =>
    ipcRenderer.invoke("window:setFullScreen", fullScreen),

  /**
   * 获取窗口全屏状态
   */
  isFullScreen: (): Promise<IpcResultDTO<boolean>> => ipcRenderer.invoke("window:isFullScreen"),

  readyToClose: (): Promise<IpcResultDTO<void>> => ipcRenderer.invoke("window:readyToClose"),

  onPrepareClose: (callback: () => void): (() => void) => {
    const listener = () => callback();
    ipcRenderer.on("window:prepare-close", listener);
    return () => ipcRenderer.removeListener("window:prepare-close", listener);
  },

  /**
   * 新建窗口（显示欢迎页）
   */
  newWindow: (): Promise<IpcResultDTO<void>> => ipcRenderer.invoke("window:new")
};
