import fs from "node:fs";
import path from "node:path";

const mediaTypes = new Map([
  [".apng", "image/apng"],
  [".avif", "image/avif"],
  [".bmp", "image/bmp"],
  [".gif", "image/gif"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
  [".aac", "audio/aac"],
  [".flac", "audio/flac"],
  [".m4a", "audio/mp4"],
  [".mp3", "audio/mpeg"],
  [".oga", "audio/ogg"],
  [".ogg", "audio/ogg"],
  [".opus", "audio/ogg"],
  [".wav", "audio/wav"],
  [".m4v", "video/mp4"],
  [".mov", "video/quicktime"],
  [".mp4", "video/mp4"],
  [".ogv", "video/ogg"],
  [".webm", "video/webm"]
]);

const documentExtensions = new Set([
  ".csv",
  ".doc",
  ".docx",
  ".epub",
  ".html",
  ".json",
  ".markdown",
  ".md",
  ".odf",
  ".odp",
  ".ods",
  ".odt",
  ".pdf",
  ".ppt",
  ".pptx",
  ".rtf",
  ".tsv",
  ".txt",
  ".xls",
  ".xlsx",
  ".xml",
  ".yaml",
  ".yml",
  ".zip"
]);

export function getLocalMediaType(filePath: string): string | undefined {
  return mediaTypes.get(path.extname(filePath).toLowerCase());
}

export function isExternalNoteFile(filePath: string): boolean {
  return !!getLocalMediaType(filePath) || documentExtensions.has(path.extname(filePath).toLowerCase());
}

export function isWindowsNetworkPath(filePath: string): boolean {
  return process.platform === "win32" && /^[/\\]{2}/.test(filePath);
}

export function resolveLocalRegularFile(filePath: unknown, allowNetworkPath = false): string | null {
  if (typeof filePath !== "string" || !path.isAbsolute(filePath) || filePath.includes("\0")) return null;
  // Remote share paths and special Windows namespaces are outside local file previews.
  if (!allowNetworkPath && isWindowsNetworkPath(filePath)) return null;
  try {
    const resolved = fs.realpathSync.native(filePath);
    return (allowNetworkPath || !isWindowsNetworkPath(resolved)) && fs.statSync(resolved).isFile() ? resolved : null;
  } catch {
    return null;
  }
}
