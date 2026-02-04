import chokidar, { FSWatcher } from "chokidar";
import { BrowserWindow } from "electron";
import path from "path";

/**
 * 文件监听器
 */
class FileWatcher {
  private watcher: FSWatcher | null = null;
  private workspacePath: string | null = null;
  private isPaused = false;

  /**
   * 开始监听工作区
   */
  startWatching(workspacePath: string): void {
    // 如果已经在监听，先停止
    this.stopWatching();

    this.workspacePath = workspacePath;

    // 只监听 .md 文件和第一层目录
    // 使用 glob 模式精确匹配，大幅减少监听范围
    const watchPatterns = [
      path.join(workspacePath, "*.md"), // 根目录的 .md 文件
      path.join(workspacePath, "*/*.md"), // 一级子目录的 .md 文件
      path.join(workspacePath, "*") // 一级子目录（用于监听文件夹增删）
    ];

    this.watcher = chokidar.watch(watchPatterns, {
      ignoreInitial: true,
      persistent: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50
      },
      // 忽略隐藏文件/目录
      ignored: /(^|[/\\])\../,
      depth: 0 // 不递归，因为 glob 模式已经指定了层级
    });

    // 文件修改事件
    this.watcher.on("change", (filePath: string) => {
      if (this.isPaused) return;
      this.handleFileChange(filePath);
    });

    // 文件添加事件
    this.watcher.on("add", (filePath: string) => {
      if (this.isPaused) return;
      this.handleFileAdd(filePath);
    });

    // 文件删除事件
    this.watcher.on("unlink", (filePath: string) => {
      if (this.isPaused) return;
      this.handleFileDelete(filePath);
    });

    // 文件夹添加事件
    this.watcher.on("addDir", (dirPath: string) => {
      if (this.isPaused) return;
      this.handleFolderAdd(dirPath);
    });

    // 文件夹删除事件
    this.watcher.on("unlinkDir", (dirPath: string) => {
      if (this.isPaused) return;
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
      this.isPaused = false;
    }
  }

  pauseWatching(): void {
    this.isPaused = true;
  }

  resumeWatching(): void {
    this.isPaused = false;
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
