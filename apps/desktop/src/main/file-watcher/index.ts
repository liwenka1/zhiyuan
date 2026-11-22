import chokidar, { FSWatcher } from "chokidar";
import { BrowserWindow } from "electron";
import path from "path";
import fs from "fs";
import { setImmediate } from "node:timers/promises";
import { isIgnoredWorkspaceDirectory, MAX_WORKSPACE_DEPTH } from "../workspace/policy";

interface WorkspaceEvent {
  channel: "file:changed" | "file:added" | "file:deleted" | "folder:added" | "folder:deleted";
  data: { filePath: string } | { folderPath: string };
}

interface WindowSubscription {
  root: string;
  pauseCount: number;
  pending: Map<string, WorkspaceEvent>;
  replay?: Promise<void>;
}

interface WatcherEntry {
  watcher: FSWatcher;
  windows: Map<number, WindowSubscription>;
}

const REPLAY_BATCH_SIZE = 16;
type DirectoryEntries = Map<string, Promise<Map<string, fs.Dirent>>>;

async function hasExactEntryPath(
  workspacePath: string,
  relativePath: string,
  isDirectory: boolean,
  entriesByParent: DirectoryEntries
): Promise<boolean> {
  let parent = workspacePath;
  const parts = relativePath.split("/");
  for (const [index, name] of parts.entries()) {
    let entries = entriesByParent.get(parent);
    if (!entries) {
      entries = fs.promises
        .readdir(parent, { withFileTypes: true })
        .then((items) => new Map(items.map((entry) => [entry.name, entry])));
      entriesByParent.set(parent, entries);
    }
    const entry = (await entries).get(name);
    const expectDirectory = index < parts.length - 1 || isDirectory;
    if (expectDirectory ? !entry?.isDirectory() : !entry?.isFile()) return false;
    parent = path.join(parent, name);
  }
  return true;
}

async function reconcileEvent(
  workspacePath: string,
  event: WorkspaceEvent,
  entriesByParent: DirectoryEntries
): Promise<WorkspaceEvent | null> {
  const { channel, data } = event;
  if (channel !== "file:deleted" && channel !== "folder:deleted") return event;
  const relativePath = "filePath" in data ? data.filePath : data.folderPath;
  const isDirectory = channel === "folder:deleted";
  try {
    const current = await fs.promises.lstat(path.join(workspacePath, relativePath));
    const matchesType = isDirectory ? current.isDirectory() : current.isFile();
    // Some case-insensitive volumes preserve the requested spelling in realpath.
    if (matchesType && (await hasExactEntryPath(workspacePath, relativePath, isDirectory, entriesByParent))) {
      return { channel: isDirectory ? "folder:added" : "file:added", data };
    }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT" && code !== "ENOTDIR") return null;
  }
  return event;
}

/**
 * 文件监听管理器
 * 支持多工作区监听，按工作区做引用计数，精准路由事件到相关窗口
 */
class FileWatcherManager {
  private watchers: Map<string, WatcherEntry> = new Map();

  private normalizeWorkspacePath(workspacePath: string): string {
    try {
      return fs.realpathSync.native(workspacePath);
    } catch {
      return path.resolve(workspacePath);
    }
  }

  /**
   * 开始监听工作区（为指定窗口注册）
   * 相同工作区只创建一个 chokidar watcher，引用计数追踪窗口
   */
  startWatching(workspacePath: string, windowId: number): void {
    const windowRoot = path.resolve(workspacePath);
    const subscription: WindowSubscription = { root: windowRoot, pauseCount: 0, pending: new Map() };
    workspacePath = this.normalizeWorkspacePath(workspacePath);
    const existing = this.watchers.get(workspacePath);
    if (existing) {
      // 工作区已有 watcher，只添加窗口引用
      const current = existing.windows.get(windowId);
      if (current) current.root = windowRoot;
      else existing.windows.set(windowId, subscription);
      return;
    }

    // 直接监听工作区根目录，确保目录重命名时子文件的 add/unlink 也能被捕获
    const shouldIgnore = (candidatePath: string, stats?: fs.Stats): boolean => {
      const relativePath = path.relative(workspacePath, candidatePath);
      if (!relativePath || relativePath === ".") return false;
      const segments = relativePath.split(path.sep).filter(Boolean);
      if (segments.some((segment) => segment.startsWith("."))) return true;
      if (segments.slice(0, -1).some((segment) => isIgnoredWorkspaceDirectory(segment))) return true;
      const lastSegment = segments.at(-1) || "";
      if (isIgnoredWorkspaceDirectory(lastSegment) && !stats?.isFile()) return true;
      // 扫描允许第 MAX_WORKSPACE_DEPTH 层目录内的文件，文件名本身还占一段路径。
      // chokidar 会先不带 stats 调用，不能在拿到文件类型前把最深层笔记排除。
      return (
        segments.length > MAX_WORKSPACE_DEPTH + 1 ||
        (segments.length > MAX_WORKSPACE_DEPTH && Boolean(stats?.isDirectory()))
      );
    };

    const watcher = chokidar.watch(workspacePath, {
      ignoreInitial: true,
      persistent: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50
      },
      ignored: shouldIgnore,
      depth: MAX_WORKSPACE_DEPTH
    });

    const entry: WatcherEntry = {
      watcher,
      windows: new Map([[windowId, subscription]])
    };

    watcher.on("error", () => {
      // watcher 错误不应冒泡成未处理的 EventEmitter error 导致主进程退出。
      // 后续文件操作仍由显式扫描兜底。
    });

    // 文件修改事件
    watcher.on("change", (filePath: string) => {
      if (!filePath.toLowerCase().endsWith(".md")) return;

      const relativePath = path.relative(workspacePath, filePath).split(path.sep).join("/");
      this.broadcastToWorkspace(workspacePath, "file:changed", { filePath: relativePath });
    });

    // 文件添加事件
    watcher.on("add", (filePath: string) => {
      if (!filePath.toLowerCase().endsWith(".md")) return;

      const relativePath = path.relative(workspacePath, filePath).split(path.sep).join("/");
      this.broadcastToWorkspace(workspacePath, "file:added", { filePath: relativePath });
    });

    // 文件删除事件
    watcher.on("unlink", (filePath: string) => {
      if (!filePath.toLowerCase().endsWith(".md")) return;

      const relativePath = path.relative(workspacePath, filePath).split(path.sep).join("/");
      this.broadcastToWorkspace(workspacePath, "file:deleted", { filePath: relativePath });
    });

    // 文件夹添加事件
    watcher.on("addDir", (dirPath: string) => {
      const relativePath = path.relative(workspacePath, dirPath).split(path.sep).join("/");
      if (!relativePath || relativePath === ".") return;

      this.broadcastToWorkspace(workspacePath, "folder:added", { folderPath: relativePath });
    });

    // 文件夹删除事件
    watcher.on("unlinkDir", (dirPath: string) => {
      const relativePath = path.relative(workspacePath, dirPath).split(path.sep).join("/");
      if (!relativePath || relativePath === ".") return;

      this.broadcastToWorkspace(workspacePath, "folder:deleted", { folderPath: relativePath });
    });

    this.watchers.set(workspacePath, entry);
  }

  /**
   * 停止监听工作区（为指定窗口解除注册）
   * 引用为 0 时销毁 watcher
   */
  stopWatching(workspacePath: string, windowId: number): void {
    workspacePath = this.normalizeWorkspacePath(workspacePath);
    const entry = this.watchers.get(workspacePath);
    if (!entry) return;

    entry.windows.delete(windowId);

    // 没有窗口引用了，销毁 watcher
    if (entry.windows.size === 0) {
      entry.watcher.close();
      this.watchers.delete(workspacePath);
    }
  }

  /**
   * 暂停指定工作区的文件监听
   */
  pauseWatching(workspacePath: string, windowId: number): void {
    workspacePath = this.normalizeWorkspacePath(workspacePath);
    const subscription = this.watchers.get(workspacePath)?.windows.get(windowId);
    if (subscription) subscription.pauseCount += 1;
  }

  /**
   * 恢复指定工作区的文件监听
   */
  async resumeWatching(workspacePath: string, windowId: number): Promise<void> {
    workspacePath = this.normalizeWorkspacePath(workspacePath);
    const subscription = this.watchers.get(workspacePath)?.windows.get(windowId);
    if (!subscription) return;
    if (subscription.pauseCount > 0) subscription.pauseCount -= 1;
    if (subscription.pauseCount > 0 || subscription.pending.size === 0) return;
    subscription.replay ??= Promise.resolve().then(() => this.replayPending(workspacePath, windowId, subscription));
    await subscription.replay;
  }

  private async replayPending(
    workspacePath: string,
    windowId: number,
    subscription: WindowSubscription
  ): Promise<void> {
    const isActive = () =>
      subscription.pauseCount === 0 && this.watchers.get(workspacePath)?.windows.get(windowId) === subscription;
    try {
      while (isActive() && subscription.pending.size > 0) {
        await setImmediate();
        if (!isActive()) break;
        const batch: Array<[string, WorkspaceEvent]> = [];
        for (const queued of subscription.pending) {
          batch.push(queued);
          if (batch.length === REPLAY_BATCH_SIZE) break;
        }
        const entriesByParent: DirectoryEntries = new Map();
        const reconciled = await Promise.all(
          batch.map(([, event]) => reconcileEvent(workspacePath, event, entriesByParent))
        );
        if (!isActive()) break;
        for (const [index, [key, event]] of batch.entries()) {
          // Check a superseding event again before sending it or any following event.
          if (subscription.pending.get(key) !== event) break;
          subscription.pending.delete(key);
          const resolved = reconciled[index];
          if (resolved) this.sendEvent(windowId, subscription, resolved);
        }
      }
    } finally {
      subscription.replay = undefined;
    }
  }

  /**
   * 广播事件到绑定了指定工作区的所有窗口
   */
  private broadcastToWorkspace(
    workspacePath: string,
    channel: WorkspaceEvent["channel"],
    data: WorkspaceEvent["data"]
  ): void {
    const entry = this.watchers.get(workspacePath);
    if (!entry) return;

    for (const [windowId, subscription] of entry.windows) {
      if (subscription.pauseCount === 0 && !subscription.replay) {
        this.sendEvent(windowId, subscription, { channel, data });
      } else {
        const key = "filePath" in data ? `file:${data.filePath}` : `folder:${data.folderPath}`;
        const previous = subscription.pending.get(key)?.channel;
        // The renderer must discover a newly added file even if it changed again before resume.
        const pendingChannel =
          channel === "file:changed" && (previous === "file:added" || previous === "file:deleted")
            ? "file:added"
            : channel;
        subscription.pending.set(key, { channel: pendingChannel, data });
      }
    }
  }

  private sendEvent(windowId: number, subscription: WindowSubscription, { channel, data }: WorkspaceEvent): void {
    const win = BrowserWindow.fromId(windowId);
    if (!win || win.isDestroyed()) return;
    const relativePath = "filePath" in data ? data.filePath : data.folderPath;
    // Match the spelling returned by this window's scan, including a symlinked workspace root.
    win.webContents.send(channel, { ...data, fullPath: path.join(subscription.root, relativePath) });
  }
}

export const fileWatcherManager = new FileWatcherManager();
