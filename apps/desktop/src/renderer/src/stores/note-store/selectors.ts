import type { NoteStoreGet } from "./types";

export function createSelectors(get: NoteStoreGet) {
  return {
    getSelectedNote: () => {
      const { notes, selectedNoteId } = get();
      return notes.find((n) => n.id === selectedNoteId);
    },

    getNotesByFolder: (folderId: string) => {
      const { notes } = get();
      return notes.filter((n) => n.folderId === folderId);
    }
  };
}
