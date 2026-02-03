import { ipcRenderer } from "electron";

export const windowApi = {
  /**
   * 设置窗口全屏状态
   */
  setFullScreen: (fullScreen: boolean): Promise<void> => ipcRenderer.invoke("window:setFullScreen", fullScreen),

  /**
   * 获取窗口全屏状态
   */
  isFullScreen: (): Promise<boolean> => ipcRenderer.invoke("window:isFullScreen")
};
