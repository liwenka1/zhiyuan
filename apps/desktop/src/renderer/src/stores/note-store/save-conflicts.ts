import { create } from "zustand";

export interface SaveConflict {
  noteId: string;
  filePath: string;
  localContent: string;
  diskContent: string | null | undefined;
}

export const useSaveConflictStore = create(() => ({ conflicts: {} as Record<string, SaveConflict> }));

export function setSaveConflict(conflict: SaveConflict): void {
  useSaveConflictStore.setState((state) => ({ conflicts: { ...state.conflicts, [conflict.filePath]: conflict } }));
}

export function clearSaveConflict(filePath: string): void {
  useSaveConflictStore.setState((state) => {
    const conflicts = { ...state.conflicts };
    delete conflicts[filePath];
    return { conflicts };
  });
}

export function assertNoSaveConflict(filePath: string): void {
  if (useSaveConflictStore.getState().conflicts[filePath]) {
    throw Object.assign(new Error("Resolve the external file conflict before saving"), {
      code: "FILE_CONTENT_CONFLICT"
    });
  }
}
