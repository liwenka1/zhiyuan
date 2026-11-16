import { useWorkspaceStore } from "@/stores/use-workspace-store";
import { useOperationStore } from "@/stores/note-store/operation-guard";
import type { NoteStore } from "@/stores/note-store/types";

export async function moveNotesInWorkspace(
  noteIds: string[],
  targetFolderId: string,
  moveNote: NoteStore["moveNote"],
  origin: { workspacePath: string | null; revision: number }
) {
  const result = { movedCount: 0, skippedCount: 0, renamedCount: 0, cancelled: false };
  for (const noteId of noteIds) {
    const current = useWorkspaceStore.getState();
    if (
      current.workspacePath !== origin.workspacePath ||
      current.revision !== origin.revision ||
      current.isLoading ||
      useOperationStore.getState().closeRequestCount > 0
    ) {
      result.cancelled = true;
      break;
    }
    const moved = await moveNote(noteId, targetFolderId, { silent: true });
    if (moved.moved) {
      result.movedCount++;
      if (moved.renamed) result.renamedCount++;
    } else {
      result.skippedCount++;
    }
  }
  return result;
}
