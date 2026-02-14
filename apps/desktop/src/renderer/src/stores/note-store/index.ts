import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { NoteStore } from "./types";
import { createNoteActions } from "./actions";
import { applyPersistence } from "./persistence";
import { createFileEventHandlers } from "./file-events";
import { createLoaders } from "./loaders";
import { createSelectors } from "./selectors";

export { clearAllDebouncedSaves } from "./persistence";

export const useNoteStore = create<NoteStore>()(
  immer((set, get) => ({
    notes: [],
    selectedNoteId: null,
    editorContent: "",
    openNoteIds: [],
    playingNoteIds: [],
    savingNoteIds: new Set(),
    isLoadingFromFileSystem: false,
    searchKeyword: "",

    ...createNoteActions(set, get),
    ...applyPersistence(set, get),
    ...createFileEventHandlers(set, get),
    ...createLoaders(set),
    ...createSelectors(get)
  }))
);
