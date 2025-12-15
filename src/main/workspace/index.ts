import { dialog, BrowserWindow } from "electron";
import fs from "fs";
import path from "path";
import { configManager } from "../config";

export interface FolderInfo {
  id: string;
  name: string;
  path: string;
  noteCount: number;
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
  async selectWorkspace(): Promise<string | null> {
    const result = await dialog.showOpenDialog(BrowserWindow.getFocusedWindow()!, {
      properties: ["openDirectory"],
      title: "选择工作区文件夹",
      buttonLabel: "选择"
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
          folders.push({
            id: entry.name,
            name: entry.name,
            path: folderPath,
            noteCount: 0 // 稍后计算
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

      // 从内容中提取标题（第一个 # 标题）
      const titleMatch = content.match(/^#\s+(.+)$/m);
      const title = titleMatch ? titleMatch[1].trim() : fileName.replace(".md", "");

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
  }
};
