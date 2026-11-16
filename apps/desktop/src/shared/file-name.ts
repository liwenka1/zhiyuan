import { isIgnoredWorkspaceDirectory } from "./workspace-policy";

const INVALID_FILE_NAME_CHARS = /[\\/:*?"<>|]/;
const WINDOWS_RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;

export function isValidFileNameSegment(value: string): boolean {
  const name = value.trim();
  if (!name || name !== value || name === "." || name === "..") return false;
  if (INVALID_FILE_NAME_CHARS.test(name)) return false;
  if ([...name].some((char) => char.charCodeAt(0) < 32)) return false;
  if (name.endsWith(".") || name.endsWith(" ")) return false;
  if (WINDOWS_RESERVED_NAMES.test(name)) return false;
  return true;
}

/** 工作区扫描忽略隐藏条目；用户创建的笔记和目录必须能够再次被加载。 */
export function isValidWorkspaceEntryName(value: string): boolean {
  return isValidFileNameSegment(value) && !value.startsWith(".");
}

export function isValidWorkspaceFolderName(value: string): boolean {
  return isValidWorkspaceEntryName(value) && !isIgnoredWorkspaceDirectory(value);
}

export function normalizeFileNameSegment(value: string): string {
  return [...value.trim()]
    .filter((char) => char.charCodeAt(0) >= 32)
    .join("")
    .replace(INVALID_FILE_NAME_CHARS, "-")
    .replace(/[. ]+$/g, "")
    .trim();
}
