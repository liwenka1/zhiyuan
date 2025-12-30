import { create } from "zustand";
import { Folder, Note } from "@/types";
import { formatMarkdown } from "@/lib/formatter";

interface NoteStore {
  // 状态
  folders: Folder[];
  notes: Note[];
  selectedFolderId: string | null;
  selectedNoteId: string | null;
  editorContent: string;
  isLoadingFromFileSystem: boolean; // 是否从文件系统加载
  searchKeyword: string; // 搜索关键词

  // 操作方法 - 文件夹
  setFolders: (folders: Folder[]) => void;
  selectFolder: (folderId: string | null) => void;
  createFolder: (name: string) => Promise<void>;
  deleteFolder: (folderId: string) => void;
  renameFolder: (folderId: string, newName: string) => Promise<void>;

  // 操作方法 - 笔记
  setNotes: (notes: Note[]) => void;
  selectNote: (noteId: string) => void;
  createNote: (folderId?: string) => Promise<void>;
  updateNoteContent: (content: string) => void;
  formatCurrentNote: () => Promise<void>;
  deleteNote: (noteId: string) => void;
  renameNote: (noteId: string, newTitle: string) => Promise<void>;
  duplicateNote: (noteId: string) => Promise<void>;

  // 搜索相关
  setSearchKeyword: (keyword: string) => void;

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

  // 导出方法
  exportNoteAsHTML: (noteId: string, isDark: boolean) => Promise<void>;
  exportNoteAsPDF: (noteId: string, isDark: boolean) => Promise<void>;
  exportNoteAsPDFPages: (noteId: string, isDark: boolean) => Promise<void>;
  exportNoteAsImage: (noteId: string, isDark: boolean) => Promise<void>;
  exportNoteAsImagePages: (noteId: string, isDark: boolean) => Promise<void>;
  copyNoteToWechat: (noteId: string) => Promise<void>;
}

export const useNoteStore = create<NoteStore>((set, get) => ({
  // 初始状态
  folders: [],
  notes: [],
  selectedFolderId: null,
  selectedNoteId: null,
  editorContent: "",
  isLoadingFromFileSystem: false,
  searchKeyword: "",

  // 文件夹操作
  setFolders: (folders) => set({ folders }),

  selectFolder: (folderId) => {
    set({
      selectedFolderId: folderId
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

  renameFolder: async (folderId, newName) => {
    const workspacePath = (await import("./use-workspace-store")).useWorkspaceStore.getState().workspacePath;
    const folder = get().folders.find((f) => f.id === folderId);

    if (!workspacePath || !folder?.path) {
      console.error("没有工作区路径或文件夹路径，无法重命名");
      return;
    }

    try {
      // 构建新的文件夹路径
      const newFolderPath = `${workspacePath}/${newName}`;

      // 在文件系统中重命名文件夹
      await window.api.folder.rename(folder.path, newFolderPath);

      // 更新 store 中的文件夹信息
      set((state) => ({
        folders: state.folders.map((f) =>
          f.id === folderId
            ? {
                ...f,
                id: newName, // 使用新名称作为 ID
                name: newName,
                path: newFolderPath,
                updatedAt: new Date().toISOString()
              }
            : f
        ),
        // 如果重命名的是当前选中的文件夹，更新选中状态
        selectedFolderId: state.selectedFolderId === folderId ? newName : state.selectedFolderId,
        // 更新该文件夹下所有笔记的 folderId
        notes: state.notes.map((n) =>
          n.folderId === folderId
            ? {
                ...n,
                folderId: newName
              }
            : n
        )
      }));
    } catch (error) {
      console.error("重命名文件夹失败:", error);
      throw error;
    }
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

  // 搜索相关
  setSearchKeyword: (keyword) => set({ searchKeyword: keyword }),

  createNote: async (folderId) => {
    // 从工作区 store 获取当前工作区路径
    const workspacePath = (await import("./use-workspace-store")).useWorkspaceStore.getState().workspacePath;

    if (!workspacePath) {
      console.error("没有工作区路径，无法创建笔记");
      return;
    }

    try {
      const targetFolderId = folderId || get().selectedFolderId || null;

      // 查找已存在的无标题笔记，确定新的序号
      const allNotes = get().notes;
      const untitledPattern = /^无标题笔记 (\d+)$/;
      const existingNumbers = allNotes
        .map((n) => {
          const match = n.title.match(untitledPattern);
          return match ? parseInt(match[1], 10) : 0;
        })
        .filter((num) => num > 0);

      // 确定新的笔记序号（从1开始，或者比最大序号大1）
      const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
      const title = `无标题笔记 ${nextNumber}`;
      const fileName = `${title}.md`;
      const content = `# ${title}\n\n开始写作...`;

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
        title, // 使用生成的标题
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

  formatCurrentNote: async () => {
    const { selectedNoteId, editorContent } = get();
    if (!selectedNoteId) return;

    try {
      // 格式化当前编辑器内容
      const formattedContent = await formatMarkdown(editorContent);

      // 更新笔记内容（这会触发保存）
      get().updateNoteContent(formattedContent);
    } catch (error) {
      console.error("格式化笔记失败:", error);
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
      isLoadingFromFileSystem: true,
      searchKeyword: "" // 重新加载时清空搜索
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

  // 导出笔记为 HTML
  exportNoteAsHTML: async (noteId, isDark) => {
    const note = get().notes.find((n) => n.id === noteId);
    if (!note) {
      console.error("笔记不存在");
      throw new Error("笔记不存在");
    }

    try {
      // 1. 获取下载目录
      const downloadsPath = await window.api.export.getDownloadsPath();

      // 2. 显示保存对话框 - 选择文件夹
      const defaultFolderName = `${note.title}`;
      const folderPath = await window.api.export.showSaveDialog({
        title: "导出为 HTML 资源包",
        defaultPath: `${downloadsPath}/${defaultFolderName}`,
        filters: [
          { name: "文件夹", extensions: [] },
          { name: "所有文件", extensions: ["*"] }
        ]
      });

      // 用户取消了保存
      if (!folderPath) {
        return;
      }

      // 3. 将 Markdown 转换为 HTML
      const { markdownToHTML } = await import("@/lib/markdown-processor");
      const htmlBody = await markdownToHTML(note.content);

      // 4. 生成完整的 HTML 文档
      const { generateHTMLDocument } = await import("@/lib/markdown-to-html");
      const fullHTML = generateHTMLDocument(note.title, htmlBody, isDark);

      // 5. 导出为资源包（包含所有图片等资源）
      const result = await window.api.export.exportHTMLPackage(fullHTML, folderPath, note.filePath, "assets");

      console.log("导出成功:", result);
      console.log(`已导出 ${result.filesCount} 个文件`);
    } catch (error) {
      console.error("导出 HTML 失败:", error);
      throw error;
    }
  },

  // 导出笔记为 PDF
  exportNoteAsPDF: async (noteId, isDark) => {
    const note = get().notes.find((n) => n.id === noteId);
    if (!note) {
      console.error("笔记不存在");
      throw new Error("笔记不存在");
    }

    try {
      // 1. 获取下载目录
      const downloadsPath = await window.api.export.getDownloadsPath();

      // 2. 显示保存对话框
      const defaultFileName = `${note.title}.pdf`;
      const filePath = await window.api.export.showSaveDialog({
        title: "导出为 PDF",
        defaultPath: `${downloadsPath}/${defaultFileName}`,
        filters: [
          { name: "PDF 文件", extensions: ["pdf"] },
          { name: "所有文件", extensions: ["*"] }
        ]
      });

      // 用户取消了保存
      if (!filePath) {
        return;
      }

      // 3. 将 Markdown 转换为 HTML
      const { markdownToHTML } = await import("@/lib/markdown-processor");
      const htmlBody = await markdownToHTML(note.content);

      // 4. 生成完整的 HTML 文档
      const { generateHTMLDocument } = await import("@/lib/markdown-to-html");
      const fullHTML = generateHTMLDocument(note.title, htmlBody, isDark);

      // 5. 导出为 PDF（传入 notePath 以支持本地图片）
      await window.api.export.exportAsPDF(fullHTML, filePath, note.filePath);

      console.log("导出 PDF 成功:", filePath);
    } catch (error) {
      console.error("导出 PDF 失败:", error);
      throw error;
    }
  },

  // 导出笔记为 PDF（分页）
  exportNoteAsPDFPages: async (noteId, isDark) => {
    const note = get().notes.find((n) => n.id === noteId);
    if (!note) {
      console.error("笔记不存在");
      throw new Error("笔记不存在");
    }

    try {
      // 1. 获取下载目录
      const downloadsPath = await window.api.export.getDownloadsPath();

      // 2. 显示保存对话框
      const defaultFileName = `${note.title}.pdf`;
      const filePath = await window.api.export.showSaveDialog({
        title: "导出为 PDF（分页）",
        defaultPath: `${downloadsPath}/${defaultFileName}`,
        filters: [
          { name: "PDF 文件", extensions: ["pdf"] },
          { name: "所有文件", extensions: ["*"] }
        ]
      });

      if (!filePath) {
        return;
      }

      // 3. 分割 Markdown
      const { splitMarkdownByHr } = await import("@/lib/markdown-splitter");
      const sections = splitMarkdownByHr(note.content);

      if (sections.length === 0) {
        throw new Error("没有内容可导出");
      }

      // 4. 为每个分片生成 HTML
      const { markdownToHTML } = await import("@/lib/markdown-processor");
      const { generateHTMLDocument } = await import("@/lib/markdown-to-html");

      const htmlContents = await Promise.all(
        sections.map(async (section) => {
          const htmlBody = await markdownToHTML(section);
          return generateHTMLDocument(note.title, htmlBody, isDark);
        })
      );

      // 5. 导出为单个 PDF（多页）
      const result = await window.api.export.exportAsPDFPages(htmlContents, filePath, note.filePath);

      console.log(`导出成功: ${result.pagesCount} 页 PDF`);
    } catch (error) {
      console.error("导出 PDF 分页失败:", error);
      throw error;
    }
  },

  // 导出笔记为图片（单张长图）
  exportNoteAsImage: async (noteId, isDark) => {
    const note = get().notes.find((n) => n.id === noteId);
    if (!note) {
      console.error("笔记不存在");
      throw new Error("笔记不存在");
    }

    try {
      // 1. 获取下载目录
      const downloadsPath = await window.api.export.getDownloadsPath();

      // 2. 显示保存对话框
      const defaultFileName = `${note.title}.png`;
      const filePath = await window.api.export.showSaveDialog({
        title: "导出为图片",
        defaultPath: `${downloadsPath}/${defaultFileName}`,
        filters: [
          { name: "PNG 图片", extensions: ["png"] },
          { name: "JPEG 图片", extensions: ["jpg", "jpeg"] },
          { name: "所有文件", extensions: ["*"] }
        ]
      });

      // 用户取消了保存
      if (!filePath) {
        return;
      }

      // 3. 将 Markdown 转换为 HTML
      const { markdownToHTML } = await import("@/lib/markdown-processor");
      const htmlBody = await markdownToHTML(note.content);

      // 4. 生成完整的 HTML 文档
      const { generateHTMLDocument } = await import("@/lib/markdown-to-html");
      const fullHTML = generateHTMLDocument(note.title, htmlBody, isDark);

      // 5. 导出为图片（传入 notePath 以支持本地图片）
      await window.api.export.exportAsImage(fullHTML, filePath, note.filePath);

      console.log("导出图片成功:", filePath);
    } catch (error) {
      console.error("导出图片失败:", error);
      throw error;
    }
  },

  // 导出笔记为图片（分页）
  exportNoteAsImagePages: async (noteId, isDark) => {
    const note = get().notes.find((n) => n.id === noteId);
    if (!note) {
      console.error("笔记不存在");
      throw new Error("笔记不存在");
    }

    try {
      // 1. 获取下载目录
      const downloadsPath = await window.api.export.getDownloadsPath();

      // 2. 显示保存对话框 - 选择文件夹
      const defaultFolderName = `${note.title}-分页`;
      const folderPath = await window.api.export.showSaveDialog({
        title: "导出为图片（分页）",
        defaultPath: `${downloadsPath}/${defaultFolderName}`,
        filters: [
          { name: "文件夹", extensions: [] },
          { name: "所有文件", extensions: ["*"] }
        ]
      });

      if (!folderPath) {
        return;
      }

      // 3. 分割 Markdown
      const { splitMarkdownByHr } = await import("@/lib/markdown-splitter");
      const sections = splitMarkdownByHr(note.content);

      if (sections.length === 0) {
        throw new Error("没有内容可导出");
      }

      // 4. 为每个分片生成 HTML
      const { markdownToHTML } = await import("@/lib/markdown-processor");
      const { generateHTMLDocument } = await import("@/lib/markdown-to-html");

      const htmlContents = await Promise.all(
        sections.map(async (section) => {
          const htmlBody = await markdownToHTML(section);
          return generateHTMLDocument(note.title, htmlBody, isDark);
        })
      );

      // 5. 导出为多张图片
      const result = await window.api.export.exportAsImagePages(htmlContents, folderPath, note.title, note.filePath);

      console.log(`导出成功: ${result.filesCount} 张图片`);
    } catch (error) {
      console.error("导出图片分页失败:", error);
      throw error;
    }
  },

  // 复制笔记到微信公众号
  copyNoteToWechat: async (noteId) => {
    const note = get().notes.find((n) => n.id === noteId);
    if (!note) {
      console.error("笔记不存在");
      throw new Error("笔记不存在");
    }

    try {
      // 1. 将 Markdown 转换为 HTML
      const { markdownToHTML } = await import("@/lib/markdown-processor");
      const htmlBody = await markdownToHTML(note.content);

      // 2. 生成适配微信公众号的 HTML 文档
      const { generateWechatHTMLDocument } = await import("@/lib/wechat-html");
      const wechatHTML = generateWechatHTMLDocument(note.title, htmlBody);

      // 3. 将 CSS 内联化（在渲染进程处理）
      const { inlineCSS } = await import("@/lib/css-inliner");
      const inlinedHTML = inlineCSS(wechatHTML);

      // 4. 复制到剪贴板
      await window.api.export.copyHTMLToClipboard(inlinedHTML);

      console.log("已复制到剪贴板，可直接粘贴到微信公众号编辑器");
    } catch (error) {
      console.error("复制到微信公众号失败:", error);
      throw error;
    }
  }
}));
