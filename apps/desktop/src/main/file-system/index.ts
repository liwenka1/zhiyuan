import fs from "fs";
import path from "path";
import crypto from "crypto";
import { shell } from "electron";

export class FileContentConflictError extends Error {
  readonly code = "FILE_CONTENT_CONFLICT";

  constructor() {
    super("File content changed outside the editor");
    this.name = "FileContentConflictError";
  }
}

async function isCaseOnlyRename(oldPath: string, newPath: string): Promise<boolean> {
  const oldResolved = path.resolve(oldPath);
  const newResolved = path.resolve(newPath);
  if (oldResolved === newResolved || oldResolved.toLowerCase() !== newResolved.toLowerCase()) return false;
  try {
    const [source, destination] = await Promise.all([fs.promises.lstat(oldPath), fs.promises.lstat(newPath)]);
    // macOS 也常使用不区分大小写的卷；Windows 也可能启用区分大小写。
    // 只能在两个路径实际指向同一条目时绕过重名保护。
    return source.dev === destination.dev && source.ino === destination.ino;
  } catch {
    return false;
  }
}

async function renameCaseOnly(oldPath: string, newPath: string): Promise<void> {
  const tempPath = path.join(
    path.dirname(oldPath),
    `.zhiyuan-${process.pid}-${crypto.randomBytes(6).toString("hex")}.case-tmp`
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
  async writeFile(filePath: string, content: string, expectedContent?: string): Promise<{ mtime: number }> {
    await this.writeFileAtomic(filePath, content, expectedContent);
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
  async writeFileAtomic(filePath: string, content: string, expectedContent?: string): Promise<void> {
    const checkContent = async (): Promise<boolean> => {
      const currentContent = await fs.promises.readFile(filePath, "utf8");
      if (currentContent === content) return true;
      if (currentContent !== expectedContent) throw new FileContentConflictError();
      return false;
    };
    // A missing file must not be recreated by a delayed editor save.
    if (expectedContent !== undefined && (await checkContent())) return;
    const dir = path.dirname(filePath);
    await fs.promises.mkdir(dir, { recursive: true });
    const tempPath = path.join(dir, `.zhiyuan-${process.pid}-${crypto.randomBytes(6).toString("hex")}.tmp`);

    let existingMode: number | undefined;
    if (process.platform !== "win32") {
      try {
        existingMode = (await fs.promises.stat(filePath)).mode & 0o7777;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }

    let ownsTempFile = false;
    try {
      // 写入期间仅当前用户可读；提交前继承原权限，避免保存扩大正文的可读范围。
      const handle = await fs.promises.open(tempPath, "wx", 0o600);
      ownsTempFile = true;
      try {
        await handle.writeFile(content, "utf-8");
        if (existingMode !== undefined) await handle.chmod(existingMode);
        await handle.sync();
      } finally {
        await handle.close();
      }
      // Check again after preparing the replacement, close to the actual commit.
      // A watcher notification is asynchronous and cannot authorize a stale write.
      if (expectedContent !== undefined && (await checkContent())) return;
      // rename 支持替换已有文件；若被权限或文件锁阻止，保留原文件并向调用方报告失败。
      // 不能先删除目标再重试，否则重试失败时原稿与临时文件会同时丢失。
      await fs.promises.rename(tempPath, filePath);
    } finally {
      if (ownsTempFile) await fs.promises.unlink(tempPath).catch(() => {});
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
    const caseOnly = await isCaseOnlyRename(oldPath, newPath);
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
    const caseOnly = await isCaseOnlyRename(oldPath, newPath);
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
