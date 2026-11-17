import type { NoteStoreGet } from "./types";
import { assertNoSaveConflict, clearDebouncedSave, getLastSavedContent, hasPendingSave } from "./persistence";

/** A path operation must not turn a clean editor cache into a filesystem write. */
export async function saveNoteBeforePathChange(get: NoteStoreGet, noteId: string): Promise<string | undefined> {
  const state = get();
  const note = state.notes.find((item) => item.id === noteId);
  if (!note?.filePath) return;
  assertNoSaveConflict(note.filePath);
  const content = state.selectedNoteId === noteId ? state.editorContent : note.content;
  const savedContent = getLastSavedContent(noteId) ?? note.content;
  const needsSave = hasPendingSave(note.filePath) || content !== savedContent;
  clearDebouncedSave(noteId, note.filePath);
  if (needsSave) await get().saveNoteToFileSystem(noteId, content, note.filePath);
  return getLastSavedContent(noteId) ?? savedContent;
}
