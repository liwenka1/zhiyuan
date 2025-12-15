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

    // 监听所有 .md 文件
    this.watcher = chokidar.watch(`${workspacePath}/**/*.md`, {
      ignoreInitial: true, // 忽略初始扫描
      awaitWriteFinish: {
        // 等待写入完成，避免读取不完整的文件
        stabilityThreshold: 100,
        pollInterval: 50
      },
      ignored: /(^|[/\\])\../ // 忽略隐藏文件
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

    console.log("文件监听已启动:", workspacePath);
  }

  /**
   * 停止监听
   */
  stopWatching(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      console.log("文件监听已停止");
    }
  }

  /**
   * 处理文件修改
   */
  private handleFileChange(filePath: string): void {
    if (!this.workspacePath) return;

    const relativePath = path.relative(this.workspacePath, filePath);
    console.log("检测到文件修改:", relativePath);

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

    const relativePath = path.relative(this.workspacePath, filePath);
    console.log("检测到文件添加:", relativePath);

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

    const relativePath = path.relative(this.workspacePath, filePath);
    console.log("检测到文件删除:", relativePath);

    // 通知渲染进程
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
      windows[0].webContents.send("file:deleted", {
        filePath: relativePath,
        fullPath: filePath
      });
    }
  }
}

export const fileWatcher = new FileWatcher();
