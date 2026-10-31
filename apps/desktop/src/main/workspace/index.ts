import { dialog, BrowserWindow } from "electron";
import fs from "fs";
import path from "path";
import { parseGitHubMetadata } from "@shared";
import { configManager } from "../config";
import { fileSystem } from "../file-system";
import { isIgnoredWorkspaceDirectory, MAX_WORKSPACE_DEPTH } from "./policy";

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
  github?: {
    issueNumber?: number;
    issueUrl?: string;
  };
}

/**
 * 工作区管理器
 *
 * 注意：不再管理全局 workspacePath，
 * 每个窗口的工作区路径由 WindowManager 在内存中管理。
 * dialog 的 parentWindow 由调用方通过参数传入。
 */
export const workspaceManager = {
  /**
   * 选择工作区文件夹
   * @param parentWindow 父窗口，用于显示对话框
   */
  async selectWorkspace(
    parentWindow: BrowserWindow,
    options?: { title?: string; buttonLabel?: string }
  ): Promise<string | null> {
    const result = await dialog.showOpenDialog(parentWindow, {
      properties: ["openDirectory"],
      title: options?.title || "Select Workspace Folder",
      buttonLabel: options?.buttonLabel || "Select"
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const selectedPath = result.filePaths[0];
    // 添加到最近打开列表
    configManager.addRecentWorkspace(selectedPath);
    return selectedPath;
  },

  /**
   * 打开文件对话框，选择 .md 文件
   * 返回选中文件的路径，并将其所在目录作为工作区路径
   * @param parentWindow 父窗口，用于显示对话框
   */
  async openFile(
    parentWindow: BrowserWindow,
    options?: { title?: string; buttonLabel?: string }
  ): Promise<{ filePath: string; workspacePath: string } | null> {
    const result = await dialog.showOpenDialog(parentWindow, {
      properties: ["openFile"],
      title: options?.title || "Open File",
      buttonLabel: options?.buttonLabel || "Open",
      filters: [{ name: "Markdown", extensions: ["md"] }]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const filePath = result.filePaths[0];
    const workspacePath = path.dirname(filePath);
    configManager.addRecentWorkspace(workspacePath);
    return { filePath, workspacePath };
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
      const rootStat = await fs.promises.stat(workspacePath);
      if (!rootStat.isDirectory()) {
        throw new Error("Workspace path is not a directory");
      }
      const entries = await fs.promises.readdir(workspacePath, { withFileTypes: true });

      // 第一遍：收集所有文件夹
      for (const entry of entries) {
        if (entry.isDirectory() && !isIgnoredWorkspaceDirectory(entry.name)) {
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

      const collectMarkdownNotes = async (
        directoryPath: string,
        folderId: string | null,
        depth: number
      ): Promise<number> => {
        const directoryEntries = await fs.promises.readdir(directoryPath, { withFileTypes: true });
        let noteCount = 0;

        for (const entry of directoryEntries) {
          if (entry.name.startsWith(".")) continue;
          const entryPath = path.join(directoryPath, entry.name);
          if (entry.isDirectory()) {
            if (depth >= MAX_WORKSPACE_DEPTH || isIgnoredWorkspaceDirectory(entry.name)) continue;
            noteCount += await collectMarkdownNotes(entryPath, folderId, depth + 1);
            continue;
          }
          if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".md")) continue;

          const note = await this.loadNote(entryPath, folderId, workspacePath);
          if (note) {
            notes.push(note);
            noteCount += 1;
          }
        }

        return noteCount;
      };

      // 根目录笔记和每个顶层文件夹中的任意深度 Markdown 文件都会被收集。
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".md")) continue;
        const note = await this.loadNote(path.join(workspacePath, entry.name), null, workspacePath);
        if (note) {
          notes.push(note);
        }
      }
      for (const folder of folders) {
        folder.noteCount = await collectMarkdownNotes(folder.path, folder.id, 1);
      }

      return { folders, notes };
    } catch (error) {
      throw error instanceof Error ? error : new Error(String(error));
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
      const title = fileName.replace(/\.md$/i, "");

      // 生成相对路径作为 ID
      const relativePath = path.relative(workspacePath, filePath).split(path.sep).join("/");

      const githubMetadata = parseGitHubMetadata(content);
      return {
        id: relativePath,
        title,
        content,
        fileName,
        filePath,
        folderId,
        createdAt: stats.birthtime.toISOString(),
        updatedAt: stats.mtime.toISOString(),
        github: githubMetadata
      };
    } catch {
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
