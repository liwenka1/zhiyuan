import chokidar, { FSWatcher } from "chokidar";
import { BrowserWindow } from "electron";
import path from "path";

/**
 * 文件监听器
 */
class FileWatcher {
  private watcher: FSWatcher | null = null;
  private workspacePath: string | null = null;

  /**
   * 开始监听工作区
   */
  startWatching(workspacePath: string): void {
    // 如果已经在监听，先停止
    this.stopWatching();

    this.workspacePath = workspacePath;

    // 直接监听工作区目录
    this.watcher = chokidar.watch(workspacePath, {
      ignoreInitial: true,
      persistent: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50
      },
      ignored: /(^|[/\\])\../, // 忽略隐藏文件
      depth: 99
    });

    // 文件修改事件
    this.watcher.on("change", (filePath: string) => {
      this.handleFileChange(filePath);
    });

    // 文件添加事件
    this.watcher.on("add", (filePath: string) => {
      this.handleFileAdd(filePath);
    });

    // 文件删除事件
    this.watcher.on("unlink", (filePath: string) => {
      this.handleFileDelete(filePath);
    });

    // 文件夹添加事件
    this.watcher.on("addDir", (dirPath: string) => {
      this.handleFolderAdd(dirPath);
    });

    // 文件夹删除事件
    this.watcher.on("unlinkDir", (dirPath: string) => {
      this.handleFolderDelete(dirPath);
    });

    // 错误处理
    this.watcher.on("error", (error) => {
      console.error("文件监听器错误:", error);
    });
  }

  /**
   * 停止监听
   */
  stopWatching(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      this.workspacePath = null;
    }
  }

  /**
   * 处理文件修改
   */
  private handleFileChange(filePath: string): void {
    if (!this.workspacePath) return;

    // 只处理 .md 文件
    if (!filePath.endsWith(".md")) return;

    const relativePath = path.relative(this.workspacePath, filePath);

    // 通知渲染进程
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
      windows[0].webContents.send("file:changed", {
        filePath: relativePath,
        fullPath: filePath
      });
    }
  }

  /**
   * 处理文件添加
   */
  private handleFileAdd(filePath: string): void {
    if (!this.workspacePath) return;

    // 只处理 .md 文件
    if (!filePath.endsWith(".md")) return;

    const relativePath = path.relative(this.workspacePath, filePath);

    // 通知渲染进程
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
      windows[0].webContents.send("file:added", {
        filePath: relativePath,
        fullPath: filePath
      });
    }
  }

  /**
   * 处理文件删除
   */
  private handleFileDelete(filePath: string): void {
    if (!this.workspacePath) return;

    // 只处理 .md 文件
    if (!filePath.endsWith(".md")) return;

    const relativePath = path.relative(this.workspacePath, filePath);

    // 通知渲染进程
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
      windows[0].webContents.send("file:deleted", {
        filePath: relativePath,
        fullPath: filePath
      });
    }
  }

  /**
   * 处理文件夹添加
   */
  private handleFolderAdd(dirPath: string): void {
    if (!this.workspacePath) return;

    const relativePath = path.relative(this.workspacePath, dirPath);

    // 忽略工作区根目录
    if (!relativePath || relativePath === ".") {
      return;
    }

    // 通知渲染进程
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
      windows[0].webContents.send("folder:added", {
        folderPath: relativePath,
        fullPath: dirPath
      });
    }
  }

  /**
   * 处理文件夹删除
   */
  private handleFolderDelete(dirPath: string): void {
    if (!this.workspacePath) return;

    const relativePath = path.relative(this.workspacePath, dirPath);

    // 忽略工作区根目录
    if (!relativePath || relativePath === ".") {
      return;
    }

    // 通知渲染进程
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
      windows[0].webContents.send("folder:deleted", {
        folderPath: relativePath,
        fullPath: dirPath
      });
    }
  }
}

export const fileWatcher = new FileWatcher();
