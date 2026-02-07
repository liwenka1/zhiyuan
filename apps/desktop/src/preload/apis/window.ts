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

  /**
   * 新建窗口（显示欢迎页）
   */
  newWindow: (): Promise<IpcResultDTO<void>> => ipcRenderer.invoke("window:new")
};
