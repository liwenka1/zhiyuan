import fs from "fs";
import path from "path";
import { shell } from "electron";

/**
 * 文件系统操作工具
 */
export const fileSystem = {
  /**
   * 读取文件内容
   */
  async readFile(filePath: string): Promise<{ content: string; mtime: number }> {
    const content = await fs.promises.readFile(filePath, "utf-8");
    const stats = await fs.promises.stat(filePath);
    return {
      content,
      mtime: stats.mtimeMs
    };
  },

  /**
   * 写入文件内容
   */
  async writeFile(filePath: string, content: string): Promise<{ mtime: number }> {
    await fs.promises.writeFile(filePath, content, "utf-8");
    const stats = await fs.promises.stat(filePath);
    return {
      mtime: stats.mtimeMs
    };
  },

  /**
   * 创建文件
   */
  async createFile(filePath: string, content: string = ""): Promise<void> {
    // 确保目录存在
    const dir = path.dirname(filePath);
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(filePath, content, "utf-8");
  },

  /**
   * 删除文件（移动到回收站）
   */
  async deleteFile(filePath: string): Promise<void> {
    await shell.trashItem(filePath);
  },

  /**
   * 创建文件夹
   */
  async createFolder(folderPath: string): Promise<void> {
    await fs.promises.mkdir(folderPath, { recursive: true });
  },

  /**
   * 删除文件夹（移动到回收站）
   */
  async deleteFolder(folderPath: string): Promise<void> {
    await shell.trashItem(folderPath);
  },

  /**
   * 检查文件是否存在
   */
  async exists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * 获取文件状态
   */
  async stat(filePath: string) {
    return await fs.promises.stat(filePath);
  },

  /**
   * 重命名文件
   */
  async renameFile(oldPath: string, newPath: string): Promise<void> {
    await fs.promises.rename(oldPath, newPath);
  },

  /**
   * 复制文件
   */
  async copyFile(sourcePath: string, destPath: string): Promise<void> {
    await fs.promises.copyFile(sourcePath, destPath);
  }
};
