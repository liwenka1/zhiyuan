import fs from "node:fs/promises";
import { fileSystem } from ".";

const pendingWrites = new Map<string, Promise<{ mtime: number }>>();

/** Serialize editor writes across windows, including aliases for overlapping workspaces. */
export async function writeExistingFile(
  filePath: string,
  content: string,
  expectedContent?: string
): Promise<{ mtime: number }> {
  const canonicalPath = await fs.realpath(filePath);
  const key = process.platform === "win32" ? canonicalPath.toLowerCase() : canonicalPath;
  const previous = pendingWrites.get(key) ?? Promise.resolve();
  const next = previous
    .catch(() => {})
    .then(async () => {
      const stat = await fs.lstat(canonicalPath);
      if (stat.isDirectory()) throw Object.assign(new Error("Target is a directory"), { code: "EISDIR" });
      if (!stat.isFile()) throw new Error("Target is not a regular file");
      // Older callers still get a baseline for the duration of this write.
      const baseline = expectedContent ?? (await fs.readFile(canonicalPath, "utf8"));
      return fileSystem.writeFile(canonicalPath, content, baseline);
    });
  const tracked = next.finally(() => {
    if (pendingWrites.get(key) === tracked) pendingWrites.delete(key);
  });
  pendingWrites.set(key, tracked);
  return tracked;
}
