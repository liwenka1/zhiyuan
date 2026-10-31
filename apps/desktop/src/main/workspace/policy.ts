export const MAX_WORKSPACE_DEPTH = 8;

// 这些目录通常是源码依赖、构建产物或工具缓存，不应被当作笔记树扫描和监听。
export const IGNORED_WORKSPACE_DIRECTORIES = new Set([
  ".git",
  ".hg",
  ".svn",
  "node_modules",
  "dist",
  "build",
  "out",
  "coverage",
  ".next",
  ".turbo",
  ".cache",
  "target",
  "vendor"
]);

export function isIgnoredWorkspaceDirectory(name: string): boolean {
  return name.startsWith(".") || IGNORED_WORKSPACE_DIRECTORIES.has(name.toLowerCase());
}
