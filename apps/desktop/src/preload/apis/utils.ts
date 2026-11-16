import { webUtils } from "electron";

const tokenArgument = process.argv.find((argument) => argument.startsWith("--zhiyuan-resource-token="));
const localResourceToken = tokenArgument?.slice("--zhiyuan-resource-token=".length) || "";

export const utilsApi = {
  getLocalResourceToken: (): string => localResourceToken,
  /**
   * 获取拖拽文件的本地路径
   * 用于处理文件拖拽到编辑器的场景
   */
  getPathForFile: (file: File): string => webUtils.getPathForFile(file)
};
