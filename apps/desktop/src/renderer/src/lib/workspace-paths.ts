function normSlashes(p: string): string {
  return p.replaceAll("\\", "/");
}

function isAbsoluteFsPath(filePath: string): boolean {
  const n = normSlashes(filePath);
  return n.startsWith("/") || /^[A-Za-z]:\//.test(n);
}

/**
 * 笔记绝对路径（统一为正斜杠，便于剪贴板与跨平台展示）
 */
export function resolveNoteAbsolutePath(
  note: { id: string; filePath?: string },
  workspacePath: string | undefined | null
): string | null {
  if (note.filePath) {
    const n = normSlashes(note.filePath);
    if (isAbsoluteFsPath(note.filePath)) return n;
    if (workspacePath) {
      const ws = normSlashes(workspacePath).replace(/\/$/, "");
      return `${ws}/${n.replace(/^\//, "")}`;
    }
    return null;
  }
  if (note.id && workspacePath) {
    const ws = normSlashes(workspacePath).replace(/\/$/, "");
    return `${ws}/${normSlashes(note.id)}`;
  }
  return null;
}

/**
 * 相对工作区根的路径（正斜杠）
 */
export function resolveNoteRelativePath(
  note: { id: string; filePath?: string },
  workspacePath: string | undefined | null
): string | null {
  if (!note.id) return null;
  const abs = resolveNoteAbsolutePath(note, workspacePath);
  if (workspacePath && abs) {
    const ws = normSlashes(workspacePath).replace(/\/$/, "");
    if (abs.startsWith(`${ws}/`)) return abs.slice(ws.length + 1);
    if (abs === ws) return "";
  }
  return normSlashes(note.id);
}

export function resolveFolderAbsolutePath(
  folder: { path?: string; name: string },
  workspacePath: string | undefined | null
): string | null {
  if (folder.path) return normSlashes(folder.path);
  if (!workspacePath) return null;
  const ws = normSlashes(workspacePath).replace(/\/$/, "");
  return `${ws}/${normSlashes(folder.name).replace(/^\//, "")}`;
}

export function resolveFolderRelativePath(
  folder: { path?: string; id: string; name: string },
  workspacePath: string | undefined | null
): string | null {
  const abs = resolveFolderAbsolutePath(folder, workspacePath);
  if (workspacePath && abs) {
    const ws = normSlashes(workspacePath).replace(/\/$/, "");
    if (abs.startsWith(`${ws}/`)) return abs.slice(ws.length + 1);
    if (abs === ws) return "";
  }
  return normSlashes(folder.id);
}
