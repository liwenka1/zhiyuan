import fs from "fs";
import path from "path";
import crypto from "crypto";
import { shell } from "electron";

function isCaseOnlyRename(oldPath: string, newPath: string): boolean {
  if (process.platform !== "win32") return false;
  const oldResolved = path.resolve(oldPath);
  const newResolved = path.resolve(newPath);
  return oldResolved !== newResolved && oldResolved.toLowerCase() === newResolved.toLowerCase();
}

async function renameCaseOnly(oldPath: string, newPath: string): Promise<void> {
  const tempPath = path.join(
    path.dirname(oldPath),
    `.${path.basename(oldPath)}.${process.pid}.${crypto.randomBytes(6).toString("hex")}.case-tmp`
  );
  await fs.promises.rename(oldPath, tempPath);
  try {
    await fs.promises.rename(tempPath, newPath);
  } catch (error) {
    await fs.promises.rename(tempPath, oldPath).catch(() => {});
    throw error;
  }
}

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
    await this.writeFileAtomic(filePath, content);
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
    // 创建语义必须是“不能覆盖已有文件”，避免重名笔记覆盖用户内容。
    await fs.promises.writeFile(filePath, content, { encoding: "utf-8", flag: "wx" });
  },

  /**
   * 通过同目录临时文件 + rename 原子提交内容。
   * 同目录保证 rename 在同一文件系统内完成，崩溃时不会留下半个 Markdown 文件。
   */
  async writeFileAtomic(filePath: string, content: string): Promise<void> {
    const dir = path.dirname(filePath);
    await fs.promises.mkdir(dir, { recursive: true });
    const tempPath = path.join(
      dir,
      `.${path.basename(filePath)}.${process.pid}.${crypto.randomBytes(6).toString("hex")}.tmp`
    );

    try {
      const handle = await fs.promises.open(tempPath, "w");
      try {
        await handle.writeFile(content, "utf-8");
        await handle.sync();
      } finally {
        await handle.close();
      }
      try {
        await fs.promises.rename(tempPath, filePath);
      } catch (error) {
        // Windows 不允许 rename 覆盖已有文件，先移除目标再完成替换。
        // 这仍然避免了半写入文件，且保留了跨平台保存能力。
        const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
        if (process.platform !== "win32" || (code !== "EEXIST" && code !== "EPERM")) {
          throw error;
        }
        await fs.promises.rm(filePath, { force: true });
        await fs.promises.rename(tempPath, filePath);
      }
    } finally {
      await fs.promises.unlink(tempPath).catch(() => {});
    }
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
    const caseOnly = isCaseOnlyRename(oldPath, newPath);
    if ((await this.exists(newPath)) && !caseOnly) {
      throw new Error("Target file already exists");
    }
    if (caseOnly) {
      await renameCaseOnly(oldPath, newPath);
      return;
    }
    await fs.promises.rename(oldPath, newPath);
  },

  /**
   * 重命名文件夹
   */
  async renameFolder(oldPath: string, newPath: string): Promise<void> {
    const caseOnly = isCaseOnlyRename(oldPath, newPath);
    if ((await this.exists(newPath)) && !caseOnly) {
      throw new Error("Target folder already exists");
    }
    if (caseOnly) {
      await renameCaseOnly(oldPath, newPath);
      return;
    }
    await fs.promises.rename(oldPath, newPath);
  },

  /**
   * 复制文件
   */
  async copyFile(sourcePath: string, destPath: string): Promise<void> {
    await fs.promises.copyFile(sourcePath, destPath, fs.constants.COPYFILE_EXCL);
  }
};
