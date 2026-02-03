import { webUtils } from "electron";

export const utilsApi = {
  /**
   * 获取拖拽文件的本地路径
   * 用于处理文件拖拽到编辑器的场景
   */
  getPathForFile: (file: File): string => webUtils.getPathForFile(file)
};
