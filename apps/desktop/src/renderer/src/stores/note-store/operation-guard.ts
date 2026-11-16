import { create } from "zustand";

export const useOperationStore = create(() => ({ fileOperationCount: 0, closeRequestCount: 0 }));

const fileOperations = new Set<Promise<void>>();
const backgroundSaves = new Set<Promise<void>>();
const publications = new Map<string, Set<string>>();

function normalizeOperationPath(value: string): string {
  const normalized = value.replaceAll("\\", "/").replace(/\/+$/, "");
  return /^[a-z]:(?:\/|$)/i.test(normalized) || normalized.startsWith("//") ? normalized.toLowerCase() : normalized;
}

export interface FileOperationTarget {
  workspacePath: string;
  path: string;
  includeDescendants?: boolean;
}

export function isPublishingPath(workspacePath: string, targetPath: string, includeDescendants = false): boolean {
  const paths = publications.get(normalizeOperationPath(workspacePath));
  if (!paths) return false;
  const target = normalizeOperationPath(targetPath);
  return [...paths].some(
    (filePath) => filePath === target || (includeDescendants && filePath.startsWith(`${target}/`))
  );
}

export function isEditingBlocked(): boolean {
  const state = useOperationStore.getState();
  return state.fileOperationCount > 0 || state.closeRequestCount > 0;
}

/** Lock before the first await, and keep the lock until paths and save baselines agree. */
export function beginFileOperation(target?: FileOperationTarget): (() => void) | null {
  if (isEditingBlocked()) return null;
  if (target && isPublishingPath(target.workspacePath, target.path, target.includeDescendants)) return null;
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => (finish = resolve));
  fileOperations.add(pending);
  useOperationStore.setState({ fileOperationCount: fileOperations.size });
  let released = false;
  return () => {
    if (released) return;
    released = true;
    fileOperations.delete(pending);
    useOperationStore.setState({ fileOperationCount: fileOperations.size });
    finish();
  };
}

export async function waitForFileOperations(): Promise<void> {
  while (fileOperations.size > 0) await Promise.all(fileOperations);
}

/** Publishing may finish with a metadata write; closing must wait for that commit too. */
export function beginBackgroundSave(): () => void {
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => (finish = resolve));
  backgroundSaves.add(pending);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    backgroundSaves.delete(pending);
    finish();
  };
}

/** The source path cannot change until its remote association has been committed locally. */
export function beginPublishing(workspacePath: string, filePath: string): (() => void) | null {
  if (isEditingBlocked() || isPublishingPath(workspacePath, filePath)) return null;
  const workspace = normalizeOperationPath(workspacePath);
  const file = normalizeOperationPath(filePath);
  const paths = publications.get(workspace) ?? new Set<string>();
  paths.add(file);
  publications.set(workspace, paths);
  const finishBackgroundSave = beginBackgroundSave();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    paths.delete(file);
    if (paths.size === 0) publications.delete(workspace);
    finishBackgroundSave();
  };
}

export async function waitForBackgroundSaves(): Promise<void> {
  while (backgroundSaves.size > 0) await Promise.all(backgroundSaves);
}

export function beginCloseRequest(): () => void {
  useOperationStore.setState((state) => ({ closeRequestCount: state.closeRequestCount + 1 }));
  let released = false;
  return () => {
    if (released) return;
    released = true;
    useOperationStore.setState((state) => ({ closeRequestCount: state.closeRequestCount - 1 }));
  };
}
