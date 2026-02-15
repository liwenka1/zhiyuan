import type { Note } from "@/types";

export interface NoteStoreState {
  notes: Note[];
  selectedNoteId: string | null;
  editorContent: string;
  openNoteIds: string[];
  playingNoteIds: string[];
  savingNoteIds: Set<string>;
  isLoadingFromFileSystem: boolean;
  searchKeyword: string;
}

export interface NoteStore extends NoteStoreState {
  setNotes: (notes: Note[]) => void;
  selectNote: (noteId: string) => void;
  createNote: (folderId?: string) => Promise<void>;
  updateNoteContent: (content: string) => void;
  updateNoteContentById: (noteId: string, content: string) => void;
  formatCurrentNote: () => Promise<void>;
  deleteNote: (noteId: string) => void;
  renameNote: (noteId: string, newTitle: string) => Promise<void>;
  duplicateNote: (noteId: string) => Promise<void>;
  togglePinNote: (noteId: string) => Promise<void>;

  setSearchKeyword: (keyword: string) => void;

  loadFromFileSystem: (data: { notes: Note[] }) => void;
  saveNoteToFileSystem: (noteId: string, content: string) => Promise<void>;

  setNotePlaying: (noteId: string, isPlaying: boolean) => void;

  handleFileAddedEvent: (filePath: string, fullPath: string) => Promise<void>;
  handleFileDeletedEvent: (filePath: string) => void;
  handleFileChangedEvent: (filePath: string, fullPath: string) => Promise<void>;

  getSelectedNote: () => Note | undefined;
  getNotesByFolder: (folderId: string) => Note[];
}

export type NoteStoreSet = (fn: ((state: NoteStore) => void) | Partial<NoteStore>) => void;
export type NoteStoreGet = () => NoteStore;
