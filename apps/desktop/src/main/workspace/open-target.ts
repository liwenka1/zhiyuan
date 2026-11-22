import fs from "node:fs";
import path from "node:path";

export type MarkdownOpenTarget = { workspacePath: string; filePath: string };

export function resolveMarkdownOpenTarget(filePath: string): MarkdownOpenTarget {
  const canonicalPath = fs.realpathSync.native(filePath);
  const name = path.basename(canonicalPath);
  if (name.startsWith(".") || !name.toLowerCase().endsWith(".md") || !fs.statSync(canonicalPath).isFile()) {
    throw new Error("The selected file is not a visible Markdown note");
  }
  return { filePath: canonicalPath, workspacePath: path.dirname(canonicalPath) };
}
