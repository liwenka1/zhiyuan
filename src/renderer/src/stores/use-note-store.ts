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
  isLoadingFromFileSystem: boolean; // 是否从文件系统加载

  // 操作方法 - 文件夹
  setFolders: (folders: Folder[]) => void;
  selectFolder: (folderId: string | null) => void;
  createFolder: (name: string) => Promise<void>;
  deleteFolder: (folderId: string) => void;

  // 操作方法 - 笔记
  setNotes: (notes: Note[]) => void;
  selectNote: (noteId: string) => void;
  createNote: (folderId?: string) => Promise<void>;
  updateNoteContent: (content: string) => void;
  deleteNote: (noteId: string) => void;

  // 文件系统相关
  loadFromFileSystem: (data: { folders: Folder[]; notes: Note[] }) => void;
  saveNoteToFileSystem: (noteId: string, content: string) => Promise<void>;

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
  isLoadingFromFileSystem: false,

  // 文件夹操作
  setFolders: (folders) => set({ folders }),

  selectFolder: (folderId) => {
    set({
      selectedFolderId: folderId,
      selectedNoteId: null,
      editorContent: ""
    });
  },

  createFolder: async (name) => {
    // 从工作区 store 获取当前工作区路径
    const workspacePath = (await import("./use-workspace-store")).useWorkspaceStore.getState().workspacePath;

    if (!workspacePath) {
      console.error("没有工作区路径，无法创建文件夹");
      return;
    }

    try {
      const folderPath = `${workspacePath}/${name}`;

      // 在文件系统中创建文件夹
      await window.api.folder.create(folderPath);

      const newFolder: Folder = {
        id: name, // 使用文件夹名作为 ID
        name,
        path: folderPath,
        noteCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      set((state) => ({
        folders: [...state.folders, newFolder]
      }));

      console.log("文件夹已创建:", folderPath);
    } catch (error) {
      console.error("创建文件夹失败:", error);
    }
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

  createNote: async (folderId) => {
    // 从工作区 store 获取当前工作区路径
    const workspacePath = (await import("./use-workspace-store")).useWorkspaceStore.getState().workspacePath;

    if (!workspacePath) {
      console.error("没有工作区路径，无法创建笔记");
      return;
    }

    try {
      const targetFolderId = folderId || get().selectedFolderId || null;
      const fileName = `无标题笔记_${Date.now()}.md`;
      const content = "# 无标题笔记\n\n开始写作...";

      // 确定文件路径
      let filePath: string;
      if (targetFolderId) {
        // 在指定文件夹中创建
        const folder = get().folders.find((f) => f.id === targetFolderId);
        if (folder?.path) {
          filePath = `${folder.path}/${fileName}`;
        } else {
          filePath = `${workspacePath}/${targetFolderId}/${fileName}`;
        }
      } else {
        // 在工作区根目录创建
        filePath = `${workspacePath}/${fileName}`;
      }

      // 在文件系统中创建文件
      await window.api.file.create(filePath, content);

      const newNote: Note = {
        id: filePath.replace(workspacePath + "/", ""), // 使用相对路径作为 ID
        title: "无标题笔记",
        content,
        fileName,
        filePath,
        folderId: targetFolderId || undefined,
        isPinned: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      set((state) => ({
        notes: [...state.notes, newNote],
        selectedNoteId: newNote.id,
        editorContent: newNote.content
      }));

      console.log("笔记已创建:", filePath);
    } catch (error) {
      console.error("创建笔记失败:", error);
    }
  },

  updateNoteContent: (content) => {
    const { selectedNoteId } = get();
    if (!selectedNoteId) return;

    // 更新内存中的内容
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

    // 如果笔记有文件路径，立即保存到文件系统
    const note = get().notes.find((n) => n.id === selectedNoteId);
    if (note?.filePath) {
      get().saveNoteToFileSystem(selectedNoteId, content);
    }
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

  // 从文件系统加载数据
  loadFromFileSystem: (data) => {
    set({
      folders: data.folders,
      notes: data.notes,
      selectedFolderId: null,
      selectedNoteId: null,
      editorContent: "",
      isLoadingFromFileSystem: true
    });
  },

  // 保存笔记到文件系统
  saveNoteToFileSystem: async (noteId, content) => {
    const note = get().notes.find((n) => n.id === noteId);
    if (!note?.filePath) return;

    try {
      await window.api.file.write(note.filePath, content);
      console.log("笔记已保存:", note.filePath);
    } catch (error) {
      console.error("保存笔记失败:", error);
    }
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
