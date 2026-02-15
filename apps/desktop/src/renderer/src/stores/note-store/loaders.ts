import type { NoteStoreSet } from "./types";
import type { Note } from "@/types";
import { parseGitHubMetadata } from "@/lib/github-metadata";
import { useWorkspaceStore } from "../use-workspace-store";
import { configIpc } from "@/ipc";

export function createLoaders(set: NoteStoreSet) {
  return {
    loadFromFileSystem: async (data: { notes: Note[] }) => {
      const workspacePath = useWorkspaceStore.getState().workspacePath;
      let pinnedNoteIds: string[] = [];

      if (workspacePath) {
        pinnedNoteIds = await configIpc.getPinnedNotes(workspacePath).catch(() => [] as string[]);
      }

      const notesWithPinState = data.notes.map((note) => ({
        ...note,
        isPinned: pinnedNoteIds.includes(note.id),
        github: parseGitHubMetadata(note.content)
      }));

      set({
        notes: notesWithPinState,
        selectedNoteId: null,
        editorContent: "",
        openNoteIds: [],
        playingNoteIds: [],
        isLoadingFromFileSystem: true,
        searchKeyword: ""
      });
    }
  };
}
