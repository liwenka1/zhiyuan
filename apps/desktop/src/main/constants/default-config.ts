import { app } from "electron";
import path from "path";

/**
 * 默认工作区配置
 * 集中管理所有默认值，方便后续更新和维护
 */
export const DEFAULT_WORKSPACE_CONFIG = {
  /**
   * 默认工作区文件夹名称
   */
  WORKSPACE_NAME: "我的工作区",

  /**
   * 默认工作区路径（用户文档目录下）
   */
  get WORKSPACE_PATH(): string {
    return path.join(app.getPath("documents"), this.WORKSPACE_NAME);
  },

  /**
   * 默认文件夹名称
   */
  DEFAULT_FOLDER_NAME: "我的笔记",

  /**
   * 用户指南文件名
   */
  GUIDE_FILE_NAME: "用户指南.md"
} as const;
