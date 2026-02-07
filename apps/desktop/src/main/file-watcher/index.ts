import chokidar, { FSWatcher } from "chokidar";
import { BrowserWindow } from "electron";
import path from "path";

interface WatcherEntry {
  watcher: FSWatcher;
  windowIds: Set<number>;
  isPaused: boolean;
}

/**
 * 文件监听管理器
 * 支持多工作区监听，按工作区做引用计数，精准路由事件到相关窗口
 */
class FileWatcherManager {
  private watchers: Map<string, WatcherEntry> = new Map();

  /**
   * 开始监听工作区（为指定窗口注册）
   * 相同工作区只创建一个 chokidar watcher，引用计数追踪窗口
   */
  startWatching(workspacePath: string, windowId: number): void {
    const existing = this.watchers.get(workspacePath);
    if (existing) {
      // 工作区已有 watcher，只添加窗口引用
      existing.windowIds.add(windowId);
      return;
    }

    // 创建新的 watcher
    const watchPatterns = [
      path.join(workspacePath, "*.md"),
      path.join(workspacePath, "*/*.md"),
      path.join(workspacePath, "*")
    ];

    const watcher = chokidar.watch(watchPatterns, {
      ignoreInitial: true,
      persistent: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50
      },
      ignored: /(^|[/\\])\../,
      depth: 0
    });

    const entry: WatcherEntry = {
      watcher,
      windowIds: new Set([windowId]),
      isPaused: false
    };

    // 文件修改事件
    watcher.on("change", (filePath: string) => {
      if (entry.isPaused) return;
      if (!filePath.endsWith(".md")) return;

      const relativePath = path.relative(workspacePath, filePath);
      this.broadcastToWorkspace(workspacePath, "file:changed", {
        filePath: relativePath,
        fullPath: filePath
      });
    });

    // 文件添加事件
    watcher.on("add", (filePath: string) => {
      if (entry.isPaused) return;
      if (!filePath.endsWith(".md")) return;

      const relativePath = path.relative(workspacePath, filePath);
      this.broadcastToWorkspace(workspacePath, "file:added", {
        filePath: relativePath,
        fullPath: filePath
      });
    });

    // 文件删除事件
    watcher.on("unlink", (filePath: string) => {
      if (entry.isPaused) return;
      if (!filePath.endsWith(".md")) return;

      const relativePath = path.relative(workspacePath, filePath);
      this.broadcastToWorkspace(workspacePath, "file:deleted", {
        filePath: relativePath,
        fullPath: filePath
      });
    });

    // 文件夹添加事件
    watcher.on("addDir", (dirPath: string) => {
      if (entry.isPaused) return;

      const relativePath = path.relative(workspacePath, dirPath);
      if (!relativePath || relativePath === ".") return;

      this.broadcastToWorkspace(workspacePath, "folder:added", {
        folderPath: relativePath,
        fullPath: dirPath
      });
    });

    // 文件夹删除事件
    watcher.on("unlinkDir", (dirPath: string) => {
      if (entry.isPaused) return;

      const relativePath = path.relative(workspacePath, dirPath);
      if (!relativePath || relativePath === ".") return;

      this.broadcastToWorkspace(workspacePath, "folder:deleted", {
        folderPath: relativePath,
        fullPath: dirPath
      });
    });

    this.watchers.set(workspacePath, entry);
  }

  /**
   * 停止监听工作区（为指定窗口解除注册）
   * 引用为 0 时销毁 watcher
   */
  stopWatching(workspacePath: string, windowId: number): void {
    const entry = this.watchers.get(workspacePath);
    if (!entry) return;

    entry.windowIds.delete(windowId);

    // 没有窗口引用了，销毁 watcher
    if (entry.windowIds.size === 0) {
      entry.watcher.close();
      this.watchers.delete(workspacePath);
    }
  }

  /**
   * 暂停指定工作区的文件监听
   */
  pauseWatching(workspacePath: string): void {
    const entry = this.watchers.get(workspacePath);
    if (entry) {
      entry.isPaused = true;
    }
  }

  /**
   * 恢复指定工作区的文件监听
   */
  resumeWatching(workspacePath: string): void {
    const entry = this.watchers.get(workspacePath);
    if (entry) {
      entry.isPaused = false;
    }
  }

  /**
   * 广播事件到绑定了指定工作区的所有窗口
   */
  private broadcastToWorkspace(workspacePath: string, channel: string, data: unknown): void {
    const entry = this.watchers.get(workspacePath);
    if (!entry) return;

    for (const windowId of entry.windowIds) {
      const win = BrowserWindow.fromId(windowId);
      if (win && !win.isDestroyed()) {
        win.webContents.send(channel, data);
      }
    }
  }
}

export const fileWatcherManager = new FileWatcherManager();
