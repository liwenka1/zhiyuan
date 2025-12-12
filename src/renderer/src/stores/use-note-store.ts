import { create } from "zustand";
import { Folder, Note } from "@/types";
import { DEMO_FOLDERS, DEMO_NOTES } from "@/constants/demo-data";

interface NoteStore {
  // 状态
  folders: Folder[];
  notes: Note[];
  selectedFolderId: string | null;
  selectedNoteId: string | null;
  editorContent: string;

  // 操作方法 - 文件夹
  setFolders: (folders: Folder[]) => void;
  selectFolder: (folderId: string | null) => void;
  createFolder: (name: string) => void;
  deleteFolder: (folderId: string) => void;

  // 操作方法 - 笔记
  setNotes: (notes: Note[]) => void;
  selectNote: (noteId: string) => void;
  createNote: (folderId?: string) => void;
  updateNoteContent: (content: string) => void;
  deleteNote: (noteId: string) => void;

  // 工具方法
  getSelectedNote: () => Note | undefined;
  getNotesByFolder: (folderId: string) => Note[];
  initWithDemoData: () => void;
}

export const useNoteStore = create<NoteStore>((set, get) => ({
  // 初始状态
  folders: [],
  notes: [],
  selectedFolderId: null,
  selectedNoteId: null,
  editorContent: "",

  // 文件夹操作
  setFolders: (folders) => set({ folders }),

  selectFolder: (folderId) => {
    set({
      selectedFolderId: folderId,
      selectedNoteId: null,
      editorContent: ""
    });
  },

  createFolder: (name) => {
    const newFolder: Folder = {
      id: Date.now().toString(),
      name,
      noteCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    set((state) => ({
      folders: [...state.folders, newFolder]
    }));
  },

  deleteFolder: (folderId) => {
    set((state) => ({
      folders: state.folders.filter((f) => f.id !== folderId),
      // 如果删除的是当前选中的文件夹，清空选中状态
      selectedFolderId: state.selectedFolderId === folderId ? null : state.selectedFolderId
    }));
  },

  // 笔记操作
  setNotes: (notes) => set({ notes }),

  selectNote: (noteId) => {
    const note = get().notes.find((n) => n.id === noteId);
    if (note) {
      set({
        selectedNoteId: noteId,
        editorContent: note.content
      });
    }
  },

  createNote: (folderId) => {
    const newNote: Note = {
      id: Date.now().toString(),
      title: "无标题笔记",
      content: "# 无标题笔记\n\n开始写作...",
      folderId: folderId || get().selectedFolderId || undefined,
      isPinned: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    set((state) => ({
      notes: [...state.notes, newNote],
      selectedNoteId: newNote.id,
      editorContent: newNote.content
    }));
  },

  updateNoteContent: (content) => {
    const { selectedNoteId } = get();
    if (!selectedNoteId) return;

    set((state) => ({
      editorContent: content,
      notes: state.notes.map((note) =>
        note.id === selectedNoteId
          ? {
              ...note,
              content,
              updatedAt: new Date().toISOString()
            }
          : note
      )
    }));
  },

  deleteNote: (noteId) => {
    set((state) => ({
      notes: state.notes.filter((n) => n.id !== noteId),
      // 如果删除的是当前选中的笔记，清空选中状态
      selectedNoteId: state.selectedNoteId === noteId ? null : state.selectedNoteId,
      editorContent: state.selectedNoteId === noteId ? "" : state.editorContent
    }));
  },

  // 工具方法
  getSelectedNote: () => {
    const { notes, selectedNoteId } = get();
    return notes.find((n) => n.id === selectedNoteId);
  },

  getNotesByFolder: (folderId) => {
    const { notes } = get();
    return notes.filter((n) => n.folderId === folderId);
  },

  initWithDemoData: () => {
    set({
      folders: DEMO_FOLDERS,
      notes: DEMO_NOTES,
      selectedFolderId: null,
      selectedNoteId: null,
      editorContent: ""
    });
  }
}));
