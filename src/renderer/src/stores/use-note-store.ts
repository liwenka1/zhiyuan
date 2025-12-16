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
  renameNote: (noteId: string, newTitle: string) => Promise<void>;
  duplicateNote: (noteId: string) => Promise<void>;

  // 文件系统相关
  loadFromFileSystem: (data: { folders: Folder[]; notes: Note[] }) => void;
  saveNoteToFileSystem: (noteId: string, content: string) => Promise<void>;

  // 文件监听处理
  handleFileAdded: (filePath: string, fullPath: string) => Promise<void>;
  handleFileDeleted: (filePath: string) => void;
  handleFileChanged: (filePath: string, fullPath: string) => Promise<void>;

  // 文件夹监听处理
  handleFolderAdded: (folderPath: string, fullPath: string) => void;
  handleFolderDeleted: (folderPath: string) => void;

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
        title: fileName.replace(".md", ""), // 使用文件名作为标题（去掉 .md 后缀）
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

  renameNote: async (noteId, newTitle) => {
    const workspacePath = (await import("./use-workspace-store")).useWorkspaceStore.getState().workspacePath;
    const note = get().notes.find((n) => n.id === noteId);

    if (!workspacePath || !note?.filePath) {
      console.error("没有工作区路径或笔记文件路径，无法重命名");
      return;
    }

    try {
      // 构建新的文件路径
      const pathParts = note.filePath.split("/");
      const oldFileName = pathParts[pathParts.length - 1];
      const newFileName = `${newTitle}.md`;
      pathParts[pathParts.length - 1] = newFileName;
      const newFilePath = pathParts.join("/");

      // 在文件系统中重命名
      await window.api.file.rename(note.filePath, newFilePath);

      // 更新 store 中的笔记信息
      const newNoteId = note.id.replace(oldFileName, newFileName);
      set((state) => ({
        notes: state.notes.map((n) =>
          n.id === noteId
            ? {
                ...n,
                id: newNoteId,
                title: newTitle,
                fileName: newFileName,
                filePath: newFilePath,
                updatedAt: new Date().toISOString()
              }
            : n
        ),
        selectedNoteId: state.selectedNoteId === noteId ? newNoteId : state.selectedNoteId
      }));
    } catch (error) {
      console.error("重命名笔记失败:", error);
      throw error;
    }
  },

  duplicateNote: async (noteId) => {
    const workspacePath = (await import("./use-workspace-store")).useWorkspaceStore.getState().workspacePath;
    const note = get().notes.find((n) => n.id === noteId);

    if (!workspacePath || !note?.filePath || !note.fileName) {
      console.error("没有工作区路径或笔记文件路径，无法复制");
      return;
    }

    try {
      // 查找已存在的副本，确定新的序号
      const allNotes = get().notes;
      const copyPattern = new RegExp(`^${note.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} Copy (\\d+)$`);
      const existingCopies = allNotes
        .map((n) => {
          const match = n.title.match(copyPattern);
          return match ? parseInt(match[1], 10) : 0;
        })
        .filter((num) => num > 0);

      // 确定新的副本序号（从1开始，或者比最大序号大1）
      const nextCopyNumber = existingCopies.length > 0 ? Math.max(...existingCopies) + 1 : 1;
      const newTitle = `${note.title} Copy ${nextCopyNumber}`;
      const newFileName = `${newTitle}.md`;

      // 构建新的文件路径
      const pathParts = note.filePath.split("/");
      pathParts[pathParts.length - 1] = newFileName;
      const newFilePath = pathParts.join("/");

      // 在文件系统中复制文件
      await window.api.file.copy(note.filePath, newFilePath);

      // 创建新笔记对象
      const newNoteId = note.id.replace(note.fileName, newFileName);
      const newNote: Note = {
        ...note,
        id: newNoteId,
        title: newTitle,
        fileName: newFileName,
        filePath: newFilePath,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // 添加到笔记列表
      set((state) => ({
        notes: [...state.notes, newNote]
      }));
    } catch (error) {
      console.error("复制笔记失败:", error);
      throw error;
    }
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
    } catch (error) {
      console.error("保存笔记失败:", error);
    }
  },

  // 处理外部添加的文件
  handleFileAdded: async (filePath, fullPath) => {
    const workspacePath = (await import("./use-workspace-store")).useWorkspaceStore.getState().workspacePath;
    if (!workspacePath) return;

    // 检查是否已存在（避免重复添加）
    const existingNote = get().notes.find((n) => n.id === filePath);
    if (existingNote) return;

    try {
      // 读取文件内容
      const { content } = await window.api.file.read(fullPath);

      // 解析文件路径，确定所属文件夹
      const pathParts = filePath.split("/");
      let folderId: string | null = null;

      if (pathParts.length > 1) {
        // 文件在子文件夹中
        folderId = pathParts[0];
      }

      // 提取文件名
      const fileName = pathParts[pathParts.length - 1];

      // 创建新笔记对象
      const newNote: Note = {
        id: filePath,
        title: fileName.replace(".md", ""),
        content,
        fileName,
        filePath: fullPath,
        folderId: folderId || undefined,
        isPinned: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // 添加到笔记列表
      set((state) => ({
        notes: [...state.notes, newNote]
      }));

      // 更新文件夹的笔记数量
      if (folderId) {
        set((state) => ({
          folders: state.folders.map((folder) =>
            folder.id === folderId ? { ...folder, noteCount: (folder.noteCount || 0) + 1 } : folder
          )
        }));
      }
    } catch (error) {
      console.error("处理添加的文件失败:", error);
    }
  },

  // 处理外部删除的文件
  handleFileDeleted: (filePath) => {
    const note = get().notes.find((n) => n.id === filePath);
    if (!note) return;

    const folderId = note.folderId;

    // 从笔记列表中移除
    set((state) => ({
      notes: state.notes.filter((n) => n.id !== filePath),
      // 如果删除的是当前选中的笔记，清空选中状态
      selectedNoteId: state.selectedNoteId === filePath ? null : state.selectedNoteId,
      editorContent: state.selectedNoteId === filePath ? "" : state.editorContent
    }));

    // 更新文件夹的笔记数量
    if (folderId) {
      set((state) => ({
        folders: state.folders.map((folder) =>
          folder.id === folderId ? { ...folder, noteCount: Math.max(0, (folder.noteCount || 0) - 1) } : folder
        )
      }));
    }
  },

  // 处理外部修改的文件
  handleFileChanged: async (filePath, fullPath) => {
    const note = get().notes.find((n) => n.id === filePath);
    if (!note) return;

    try {
      // 读取更新后的内容
      const { content } = await window.api.file.read(fullPath);

      const { selectedNoteId } = get();
      const isCurrentlyEditing = selectedNoteId === filePath;

      // 更新笔记内容
      set((state) => ({
        notes: state.notes.map((n) =>
          n.id === filePath
            ? {
                ...n,
                content,
                updatedAt: new Date().toISOString()
              }
            : n
        ),
        // 如果是当前正在编辑的笔记，同时更新编辑器内容
        editorContent: isCurrentlyEditing ? content : state.editorContent
      }));
    } catch (error) {
      console.error("处理修改的文件失败:", error);
    }
  },

  // 处理外部添加的文件夹
  handleFolderAdded: (folderPath, fullPath) => {
    // 检查是否已存在（避免重复添加）
    const existingFolder = get().folders.find((f) => f.id === folderPath);
    if (existingFolder) return;

    // 创建新文件夹对象
    const newFolder: Folder = {
      id: folderPath,
      name: folderPath,
      path: fullPath,
      noteCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // 添加到文件夹列表
    set((state) => ({
      folders: [...state.folders, newFolder]
    }));
  },

  // 处理外部删除的文件夹
  handleFolderDeleted: (folderPath) => {
    const folder = get().folders.find((f) => f.id === folderPath);
    if (!folder) return;

    const { selectedNoteId, notes } = get();
    const currentNote = notes.find((n) => n.id === selectedNoteId);
    const shouldClearSelection = currentNote?.folderId === folderPath;

    // 从文件夹列表中移除
    set((state) => ({
      folders: state.folders.filter((f) => f.id !== folderPath),
      notes: state.notes.filter((n) => n.folderId !== folderPath),
      selectedFolderId: state.selectedFolderId === folderPath ? null : state.selectedFolderId,
      selectedNoteId: shouldClearSelection ? null : state.selectedNoteId,
      editorContent: shouldClearSelection ? "" : state.editorContent
    }));
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
