/**
 * Utils IPC wrapper
 * 注意：这些是同步方法，不需要 unwrap
 */

export const utilsIpc = {
  getPathForFile: (file: File): string => window.api.utils.getPathForFile(file)
};
