/**
 * IPC wrapper 统一导出
 *
 * 使用方式：
 * import { workspaceIpc, fileIpc } from "@/ipc";
 * const data = await workspaceIpc.scan(path);
 *
 * 错误处理：
 * - 大部分方法失败时会 throw Error，调用方用 try/catch 处理
 * - watcher.pause/resume 使用 safeUnwrap，失败只记录日志不中断
 */

export { workspaceIpc } from "./workspace";
export { fileIpc } from "./file";
export { folderIpc } from "./folder";
export { watcherIpc } from "./watcher";
export { shellIpc } from "./shell";
export { windowIpc } from "./window";
export { exportIpc } from "./export";
export { configIpc } from "./config";
export { rssIpc } from "./rss";
export { urlIpc } from "./url";
export { themeIpc } from "./theme";
export { utilsIpc } from "./utils";
export { githubIpc } from "./github";
export { terminalIpc } from "./terminal";
