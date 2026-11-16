import { ipcRenderer } from "electron";
import type { IpcResultDTO } from "@shared";

type ExternalOpenPayload = { workspacePath: string; filePath?: string };
const externalOpenListeners = new Set<(payload: ExternalOpenPayload) => void>();
const pendingExternalOpens: ExternalOpenPayload[] = [];
let deliveringExternalOpens = false;

function deliverPendingExternalOpens(): void {
  if (deliveringExternalOpens) return;
  deliveringExternalOpens = true;
  try {
    while (externalOpenListeners.size > 0) {
      const payload = pendingExternalOpens.shift();
      if (!payload) break;
      for (const listener of [...externalOpenListeners]) listener(payload);
    }
  } finally {
    deliveringExternalOpens = false;
  }
}

// Preload runs before page load finishes; React may subscribe after the startup event arrives.
ipcRenderer.on("workspace:external-open", (_event: Electron.IpcRendererEvent, payload: ExternalOpenPayload) => {
  pendingExternalOpens.push(payload);
  deliverPendingExternalOpens();
});

export const workspaceApi = {
  /**
   * 选择工作区文件夹
   */
  select: (options?: { title?: string; buttonLabel?: string }): Promise<IpcResultDTO<string | null>> =>
    ipcRenderer.invoke("workspace:select", options),

  /**
   * 获取当前工作区路径
   */
  getCurrent: (): Promise<IpcResultDTO<string | null>> => ipcRenderer.invoke("workspace:getCurrent"),

  /**
   * 扫描工作区
   */
  scan: (
    workspacePath: string
  ): Promise<
    IpcResultDTO<{
      folders: Array<{ id: string; name: string; path: string; noteCount: number }>;
      notes: Array<{
        id: string;
        title: string;
        content: string;
        fileName: string;
        filePath: string;
        folderId: string | null;
        createdAt: string;
        updatedAt: string;
      }>;
    } | null>
  > => ipcRenderer.invoke("workspace:scan", workspacePath),

  /**
   * 验证并批准从系统拖入的 Markdown 文件所在目录
   */
  approveDroppedFile: (filePath: string): Promise<IpcResultDTO<{ filePath: string; workspacePath: string }>> =>
    ipcRenderer.invoke("workspace:approveDroppedFile", filePath),

  /**
   * 打开文件对话框，选择 .md 文件
   */
  openFile: (options?: {
    title?: string;
    buttonLabel?: string;
  }): Promise<IpcResultDTO<{ filePath: string; workspacePath: string } | null>> =>
    ipcRenderer.invoke("workspace:openFile", options),

  /**
   * 获取最近打开的工作区
   */
  getRecent: (): Promise<IpcResultDTO<string[]>> => ipcRenderer.invoke("workspace:getRecent"),

  /**
   * 导入外部 Markdown 文件到目标目录
   */
  importMarkdownFiles: (
    sourcePaths: string[],
    targetDir: string
  ): Promise<
    IpcResultDTO<{
      importedCount: number;
      skippedCount: number;
      importedPaths: string[];
    }>
  > => ipcRenderer.invoke("workspace:importMarkdownFiles", sourcePaths, targetDir),

  /**
   * 将工作区内文件拖出到系统（Copy-out）
   */
  startDragOut: (filePath: string): Promise<IpcResultDTO<void>> =>
    ipcRenderer.invoke("workspace:startDragOut", filePath),

  /**
   * 监听菜单「打开文件夹」事件
   */
  onMenuOpenFolder: (callback: () => void): (() => void) => {
    const listener = () => callback();
    ipcRenderer.on("menu:openFolder", listener);
    return () => ipcRenderer.removeListener("menu:openFolder", listener);
  },

  /**
   * 监听菜单「打开文件」事件
   */
  onMenuOpenFile: (callback: () => void): (() => void) => {
    const listener = () => callback();
    ipcRenderer.on("menu:openFile", listener);
    return () => ipcRenderer.removeListener("menu:openFile", listener);
  },

  /**
   * 监听外部打开（拖拽到图标等）事件
   */
  onExternalOpen: (callback: (payload: ExternalOpenPayload) => void): (() => void) => {
    const listener = (payload: ExternalOpenPayload) => callback(payload);
    externalOpenListeners.add(listener);
    deliverPendingExternalOpens();
    return () => {
      externalOpenListeners.delete(listener);
    };
  }
};
