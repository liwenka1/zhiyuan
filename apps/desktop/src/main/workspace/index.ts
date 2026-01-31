import { dialog, BrowserWindow } from "electron";
import fs from "fs";
import path from "path";
import { configManager } from "../config";
import { fileSystem } from "../file-system";
import { DEFAULT_WORKSPACE_CONFIG } from "../constants/default-config";
import { USER_GUIDE_CONTENT } from "../constants/guide-template";

export interface FolderInfo {
  id: string;
  name: string;
  path: string;
  noteCount: number;
  isRss?: boolean;
}

export interface NoteInfo {
  id: string;
  title: string;
  content: string;
  fileName: string;
  filePath: string;
  folderId: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * 工作区管理器
 */
export const workspaceManager = {
  /**
   * 选择工作区文件夹
   */
  async selectWorkspace(options?: { title?: string; buttonLabel?: string }): Promise<string | null> {
    const result = await dialog.showOpenDialog(BrowserWindow.getFocusedWindow()!, {
      properties: ["openDirectory"],
      title: options?.title || "Select Workspace Folder",
      buttonLabel: options?.buttonLabel || "Select"
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const selectedPath = result.filePaths[0];
    // 保存到配置
    configManager.setWorkspacePath(selectedPath);
    return selectedPath;
  },

  /**
   * 获取当前工作区路径
   */
  getCurrentWorkspace(): string | null {
    return configManager.getWorkspacePath();
  },

  /**
   * 扫描工作区，获取所有文件夹和笔记
   */
  async scanWorkspace(workspacePath: string): Promise<{
    folders: FolderInfo[];
    notes: NoteInfo[];
  }> {
    const folders: FolderInfo[] = [];
    const notes: NoteInfo[] = [];

    try {
      const entries = await fs.promises.readdir(workspacePath, { withFileTypes: true });

      // 第一遍：收集所有文件夹
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const folderPath = path.join(workspacePath, entry.name);
          const rssConfigPath = path.join(folderPath, ".rss.json");
          const isRss = await fileSystem.exists(rssConfigPath);
          folders.push({
            id: entry.name,
            name: entry.name,
            path: folderPath,
            noteCount: 0,
            isRss
          });
        }
      }

      // 第二遍：收集所有 markdown 文件
      // 1. 根目录的 .md 文件
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith(".md")) {
          const filePath = path.join(workspacePath, entry.name);
          const note = await this.loadNote(filePath, null, workspacePath);
          if (note) {
            notes.push(note);
          }
        }
      }

      // 2. 各个文件夹内的 .md 文件
      for (const folder of folders) {
        const folderEntries = await fs.promises.readdir(folder.path, { withFileTypes: true });
        let noteCount = 0;

        for (const entry of folderEntries) {
          if (entry.isFile() && entry.name.endsWith(".md")) {
            const filePath = path.join(folder.path, entry.name);
            const note = await this.loadNote(filePath, folder.id, workspacePath);
            if (note) {
              notes.push(note);
              noteCount++;
            }
          }
        }

        folder.noteCount = noteCount;
      }

      return { folders, notes };
    } catch (error) {
      console.error("扫描工作区失败:", error);
      return { folders: [], notes: [] };
    }
  },

  /**
   * 加载单个笔记文件
   */
  async loadNote(filePath: string, folderId: string | null, workspacePath: string): Promise<NoteInfo | null> {
    try {
      const content = await fs.promises.readFile(filePath, "utf-8");
      const stats = await fs.promises.stat(filePath);
      const fileName = path.basename(filePath);

      // 直接使用文件名作为标题（去掉 .md 后缀）
      const title = fileName.replace(".md", "");

      // 生成相对路径作为 ID
      const relativePath = path.relative(workspacePath, filePath);

      return {
        id: relativePath,
        title,
        content,
        fileName,
        filePath,
        folderId,
        createdAt: stats.birthtime.toISOString(),
        updatedAt: stats.mtime.toISOString()
      };
    } catch (error) {
      console.error("加载笔记失败:", filePath, error);
      return null;
    }
  },

  /**
   * 获取最近打开的工作区列表
   */
  getRecentWorkspaces(): string[] {
    return configManager.getRecentWorkspaces();
  },

  /**
   * 创建默认工作区
   * 用于首次启动应用时初始化工作环境
   */
  async createDefaultWorkspace(): Promise<string> {
    try {
      const workspacePath = DEFAULT_WORKSPACE_CONFIG.WORKSPACE_PATH;
      const defaultFolderPath = path.join(workspacePath, DEFAULT_WORKSPACE_CONFIG.DEFAULT_FOLDER_NAME);
      const guideFilePath = path.join(defaultFolderPath, DEFAULT_WORKSPACE_CONFIG.GUIDE_FILE_NAME);

      // 1. 创建工作区根目录
      await fs.promises.mkdir(workspacePath, { recursive: true });

      // 2. 创建默认文件夹
      await fs.promises.mkdir(defaultFolderPath, { recursive: true });

      // 3. 创建用户指南文件
      await fs.promises.writeFile(guideFilePath, USER_GUIDE_CONTENT, "utf-8");

      // 4. 保存工作区路径到配置
      configManager.setWorkspacePath(workspacePath);

      return workspacePath;
    } catch (error) {
      console.error("创建默认工作区失败:", error);
      throw error;
    }
  },

  /**
   * 检查默认工作区是否存在
   */
  async checkDefaultWorkspaceExists(): Promise<boolean> {
    try {
      const workspacePath = DEFAULT_WORKSPACE_CONFIG.WORKSPACE_PATH;
      await fs.promises.access(workspacePath);
      return true;
    } catch {
      return false;
    }
  }
};
