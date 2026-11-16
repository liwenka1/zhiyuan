import { create } from "zustand";

export const useOperationStore = create(() => ({ fileOperationCount: 0, closeRequestCount: 0 }));

const fileOperations = new Set<Promise<void>>();
const backgroundSaves = new Set<Promise<void>>();

export function isEditingBlocked(): boolean {
  const state = useOperationStore.getState();
  return state.fileOperationCount > 0 || state.closeRequestCount > 0;
}

/** Lock before the first await, and keep the lock until paths and save baselines agree. */
export function beginFileOperation(): (() => void) | null {
  if (isEditingBlocked()) return null;
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
