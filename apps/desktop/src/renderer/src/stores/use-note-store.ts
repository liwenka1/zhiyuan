import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { Note } from "@/types";
import { formatMarkdown } from "@/lib/formatter";
import i18n from "@/lib/i18n";
import { toast } from "sonner";
import { useWorkspaceStore } from "./use-workspace-store";
import { useFolderStore } from "./use-folder-store";
import { handleFileAdded, handleFileChanged } from "@/lib/file-watcher";

const MAX_OPEN_NOTES = 10;

// 防抖保存：存储每个笔记的防抖定时器
const debouncedSaves = new Map<string, ReturnType<typeof setTimeout>>();

// 最近保存的笔记记录（用于防止文件监听器误触发）
// 记录格式：{ noteId: 保存时间戳 }
const recentSaves = new Map<string, number>();

// 清除指定笔记的防抖定时器
function clearDebouncedSave(noteId: string) {
  const timer = debouncedSaves.get(noteId);
  if (timer) {
    clearTimeout(timer);
    debouncedSaves.delete(noteId);
  }
}

// 清除所有防抖定时器
export function clearAllDebouncedSaves() {
  debouncedSaves.forEach((timer) => clearTimeout(timer));
  debouncedSaves.clear();
}

// 记录笔记保存时间
function recordSaveTime(noteId: string) {
  recentSaves.set(noteId, Date.now());
  // 500ms 后自动清除记录
  setTimeout(() => {
    recentSaves.delete(noteId);
  }, 500);
}

// 检查笔记是否最近被保存过
function wasRecentlySaved(noteId: string, withinMs = 500): boolean {
  const saveTime = recentSaves.get(noteId);
  if (!saveTime) return false;
  return Date.now() - saveTime < withinMs;
}

interface NoteStore {
  // 状态
  notes: Note[];
  selectedNoteId: string | null;
  editorContent: string;
  openNoteIds: string[];
  playingNoteIds: string[];
  savingNoteIds: Set<string>; // 正在保存的笔记 ID
  isLoadingFromFileSystem: boolean; // 是否从文件系统加载
  searchKeyword: string; // 搜索关键词

  // 操作方法 - 笔记
  setNotes: (notes: Note[]) => void;
  selectNote: (noteId: string) => void;
  createNote: (folderId?: string) => Promise<void>;
  updateNoteContent: (content: string) => void;
  formatCurrentNote: () => Promise<void>;
  deleteNote: (noteId: string) => void;
  renameNote: (noteId: string, newTitle: string) => Promise<void>;
  duplicateNote: (noteId: string) => Promise<void>;
  togglePinNote: (noteId: string) => Promise<void>;

  // 搜索相关
  setSearchKeyword: (keyword: string) => void;

  // 文件系统相关
  loadFromFileSystem: (data: { notes: Note[] }) => void;
  saveNoteToFileSystem: (noteId: string, content: string) => Promise<void>;

  // 媒体播放相关
  setNotePlaying: (noteId: string, isPlaying: boolean) => void;

  // 文件监听处理
  handleFileAddedEvent: (filePath: string, fullPath: string) => Promise<void>;
  handleFileDeletedEvent: (filePath: string) => void;
  handleFileChangedEvent: (filePath: string, fullPath: string) => Promise<void>;

  // 工具方法
  getSelectedNote: () => Note | undefined;
  getNotesByFolder: (folderId: string) => Note[];
}

export const useNoteStore = create<NoteStore>()(
  immer((set, get) => ({
    // 初始状态
    notes: [],
    selectedNoteId: null,
    editorContent: "",
    openNoteIds: [],
    playingNoteIds: [],
    savingNoteIds: new Set(),
    isLoadingFromFileSystem: false,
    searchKeyword: "",

    // 笔记操作
    setNotes: (notes) =>
      set((state) => {
        state.notes = notes;
        state.openNoteIds = state.openNoteIds.filter((id) => notes.some((note) => note.id === id));
      }),

    selectNote: (noteId) => {
      const { selectedNoteId, editorContent } = get();

      // 切换前，立即保存当前笔记（跳过防抖）
      if (selectedNoteId && editorContent) {
        const currentNote = get().notes.find((n) => n.id === selectedNoteId);
        if (currentNote?.filePath) {
          // 清除防抖定时器
          clearDebouncedSave(selectedNoteId);
          // 立即保存
          get().saveNoteToFileSystem(selectedNoteId, editorContent);
        }
      }

      // 切换到新笔记
      const note = get().notes.find((n) => n.id === noteId);
      if (!note) return;

      set((state) => {
        // 移除已存在的并添加到末尾
        state.openNoteIds = state.openNoteIds.filter((id) => id !== noteId);
        state.openNoteIds.push(noteId);

        // 限制打开笔记数量
        if (state.openNoteIds.length > MAX_OPEN_NOTES) {
          state.openNoteIds.shift();
        }

        state.selectedNoteId = noteId;
        state.editorContent = note.content;
      });
    },

    // 搜索相关
    setSearchKeyword: (keyword) => set({ searchKeyword: keyword }),

    createNote: async (folderId) => {
      // 从工作区 store 获取当前工作区路径
      const workspacePath = useWorkspaceStore.getState().workspacePath;

      if (!workspacePath) {
        console.error("没有工作区路径，无法创建笔记");
        return;
      }

      try {
        const targetFolderId = folderId || useFolderStore.getState().selectedFolderId || null;

        // 查找已存在的无标题笔记，确定新的序号
        const allNotes = get().notes;
        const defaultTitle = i18n.t("note:defaultTitle");
        const untitledPattern = new RegExp(`^${defaultTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} (\\d+)$`);
        const existingNumbers = allNotes
          .map((n) => {
            const match = n.title.match(untitledPattern);
            return match ? parseInt(match[1], 10) : 0;
          })
          .filter((num) => num > 0);

        // 确定新的笔记序号（从1开始，或者比最大序号大1）
        const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
        const title = `${defaultTitle} ${nextNumber}`;
        const fileName = `${title}.md`;
        const content = `# ${title}\n\n${i18n.t("note:defaultContent")}`;

        // 确定文件路径
        let filePath: string;
        if (targetFolderId) {
          // 在指定文件夹中创建
          const folder = useFolderStore.getState().folders.find((f) => f.id === targetFolderId);
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
        const createResult = await window.api.file.create(filePath, content);
        if (!createResult.ok) {
          console.error("创建文件失败:", createResult.error.message);
          return;
        }

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

        set((state) => {
          // 添加新笔记
          state.notes.push(newNote);

          // 更新打开的笔记列表
          state.openNoteIds = state.openNoteIds.filter((id) => id !== newNote.id);
          state.openNoteIds.push(newNote.id);

          // 限制打开笔记数量
          if (state.openNoteIds.length > MAX_OPEN_NOTES) {
            state.openNoteIds.shift();
          }

          state.selectedNoteId = newNote.id;
          state.editorContent = newNote.content;
        });
      } catch (error) {
        console.error("创建笔记失败:", error);
      }
    },

    updateNoteContent: (content) => {
      const { selectedNoteId } = get();
      if (!selectedNoteId) return;

      // 1. 立即更新内存（用户体验流畅）
      set((state) => {
        state.editorContent = content;

        const note = state.notes.find((n) => n.id === selectedNoteId);
        if (note) {
          note.content = content;
          note.updatedAt = new Date().toISOString();
        }
      });

      // 2. 防抖保存到磁盘（减少 I/O，解决卡顿）
      const note = get().notes.find((n) => n.id === selectedNoteId);
      if (!note?.filePath) return;

      // 清除之前的定时器
      clearDebouncedSave(selectedNoteId);

      // 设置新的定时器：500ms 后保存
      const timer = setTimeout(() => {
        get().saveNoteToFileSystem(selectedNoteId, content);
        debouncedSaves.delete(selectedNoteId);
      }, 500);

      debouncedSaves.set(selectedNoteId, timer);
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
      set((state) => {
        state.notes = state.notes.filter((n) => n.id !== noteId);
        state.openNoteIds = state.openNoteIds.filter((id) => id !== noteId);
        state.playingNoteIds = state.playingNoteIds.filter((id) => id !== noteId);

        // 如果删除的是当前选中的笔记，清空选中状态
        if (state.selectedNoteId === noteId) {
          state.selectedNoteId = null;
          state.editorContent = "";
        }
      });
    },

    renameNote: async (noteId, newTitle) => {
      const workspacePath = useWorkspaceStore.getState().workspacePath;
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
        const renameResult = await window.api.file.rename(note.filePath, newFilePath);
        if (!renameResult.ok) {
          throw new Error(renameResult.error.message);
        }

        // 更新 store 中的笔记信息
        const newNoteId = note.id.replace(oldFileName, newFileName);
        set((state) => {
          const targetNote = state.notes.find((n) => n.id === noteId);
          if (targetNote) {
            targetNote.id = newNoteId;
            targetNote.title = newTitle;
            targetNote.fileName = newFileName;
            targetNote.filePath = newFilePath;
            targetNote.updatedAt = new Date().toISOString();
          }

          // 更新打开的笔记列表中的 ID
          const openIndex = state.openNoteIds.indexOf(noteId);
          if (openIndex !== -1) {
            state.openNoteIds[openIndex] = newNoteId;
          }

          // 更新选中的笔记 ID
          if (state.selectedNoteId === noteId) {
            state.selectedNoteId = newNoteId;
          }
        });
      } catch (error) {
        console.error("重命名笔记失败:", error);
        throw error;
      }
    },

    duplicateNote: async (noteId) => {
      const workspacePath = useWorkspaceStore.getState().workspacePath;
      const note = get().notes.find((n) => n.id === noteId);

      if (!workspacePath || !note?.filePath || !note.fileName) {
        console.error("没有工作区路径或笔记文件路径，无法复制");
        return;
      }

      try {
        // 查找已存在的副本，确定新的序号
        const allNotes = get().notes;
        const copySuffix = i18n.t("note:copySuffix");
        const copyPattern = new RegExp(`^${note.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} ${copySuffix} (\\d+)$`);
        const existingCopies = allNotes
          .map((n) => {
            const match = n.title.match(copyPattern);
            return match ? parseInt(match[1], 10) : 0;
          })
          .filter((num) => num > 0);

        // 确定新的副本序号（从1开始，或者比最大序号大1）
        const nextCopyNumber = existingCopies.length > 0 ? Math.max(...existingCopies) + 1 : 1;
        const newTitle = `${note.title} ${copySuffix} ${nextCopyNumber}`;
        const newFileName = `${newTitle}.md`;

        // 构建新的文件路径
        const pathParts = note.filePath.split("/");
        pathParts[pathParts.length - 1] = newFileName;
        const newFilePath = pathParts.join("/");

        // 在文件系统中复制文件
        const copyResult = await window.api.file.copy(note.filePath, newFilePath);
        if (!copyResult.ok) {
          throw new Error(copyResult.error.message);
        }

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
        set((state) => {
          state.notes.push(newNote);
        });
      } catch (error) {
        console.error("复制笔记失败:", error);
        throw error;
      }
    },

    togglePinNote: async (noteId) => {
      const workspacePath = useWorkspaceStore.getState().workspacePath;
      const note = get().notes.find((n) => n.id === noteId);

      if (!workspacePath || !note) {
        console.error("没有工作区路径或笔记不存在，无法切换置顶状态");
        return;
      }

      try {
        // 切换置顶状态
        const newPinnedState = !note.isPinned;

        // 更新内存中的状态
        set((state) => {
          const targetNote = state.notes.find((n) => n.id === noteId);
          if (targetNote) {
            targetNote.isPinned = newPinnedState;
          }
        });

        // 持久化到配置
        const allPinnedNotes = get()
          .notes.filter((n) => n.isPinned)
          .map((n) => n.id);
        const result = await window.api.config.setPinnedNotes(workspacePath, allPinnedNotes);
        if (!result.ok) {
          throw new Error(result.error.message);
        }
      } catch (error) {
        console.error("切换置顶状态失败:", error);
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
    loadFromFileSystem: async (data) => {
      // 从配置中加载置顶笔记列表
      const workspacePath = useWorkspaceStore.getState().workspacePath;
      let pinnedNoteIds: string[] = [];

      if (workspacePath) {
        try {
          const result = await window.api.config.getPinnedNotes(workspacePath);
          if (result.ok) {
            pinnedNoteIds = result.value;
          } else {
            console.error("加载置顶笔记列表失败:", result.error.message);
          }
        } catch (error) {
          console.error("加载置顶笔记列表失败:", error);
        }
      }

      // 将置顶状态应用到笔记数据
      const notesWithPinState = data.notes.map((note) => ({
        ...note,
        isPinned: pinnedNoteIds.includes(note.id)
      }));

      set({
        notes: notesWithPinState,
        selectedNoteId: null,
        editorContent: "",
        openNoteIds: [],
        playingNoteIds: [],
        isLoadingFromFileSystem: true,
        searchKeyword: "" // 重新加载时清空搜索
      });
    },

    // 保存笔记到文件系统
    saveNoteToFileSystem: async (noteId, content) => {
      const note = get().notes.find((n) => n.id === noteId);
      if (!note?.filePath) return;

      try {
        // 标记为正在保存
        set((state) => {
          state.savingNoteIds.add(noteId);
        });

        // 记录保存时间（用于文件监听器判断）
        recordSaveTime(noteId);

        const writeResult = await window.api.file.write(note.filePath, content);

        // 写入完成后立即移除标记
        // 文件监听器会通过 wasRecentlySaved() 检查来避免误触发
        set((state) => {
          state.savingNoteIds.delete(noteId);
        });

        if (!writeResult.ok) {
          toast.error(`${i18n.t("note:errors.saveNoteFailed")}: ${writeResult.error.message}`);
        }
      } catch (error) {
        // 出错也要移除标记
        set((state) => {
          state.savingNoteIds.delete(noteId);
        });

        const errorMessage = error instanceof Error ? error.message : String(error);
        toast.error(`${i18n.t("note:errors.saveNoteFailed")}: ${errorMessage}`);
      }
    },

    // 处理外部添加的文件
    handleFileAddedEvent: async (filePath, fullPath) => {
      const workspacePath = useWorkspaceStore.getState().workspacePath;
      if (!workspacePath) return;

      const newNote = await handleFileAdded(filePath, fullPath, workspacePath, get().notes);
      if (!newNote) return;

      // 添加到笔记列表
      set((state) => {
        state.notes.push(newNote);
      });

      // 更新文件夹的笔记数量
      if (newNote.folderId) {
        const folderStore = useFolderStore.getState();
        folderStore.setFolders(
          folderStore.folders.map((folder) =>
            folder.id === newNote.folderId ? { ...folder, noteCount: (folder.noteCount || 0) + 1 } : folder
          )
        );
      }
    },

    // 处理外部删除的文件
    handleFileDeletedEvent: (filePath) => {
      const note = get().notes.find((n) => n.id === filePath);
      if (!note) return;

      const folderId = note.folderId;

      // 从笔记列表中移除
      set((state) => {
        state.notes = state.notes.filter((n) => n.id !== filePath);
        state.openNoteIds = state.openNoteIds.filter((id) => id !== filePath);
        state.playingNoteIds = state.playingNoteIds.filter((id) => id !== filePath);

        // 如果删除的是当前选中的笔记，清空选中状态
        if (state.selectedNoteId === filePath) {
          state.selectedNoteId = null;
          state.editorContent = "";
        }
      });

      // 更新文件夹的笔记数量
      if (folderId) {
        const folderStore = useFolderStore.getState();
        folderStore.setFolders(
          folderStore.folders.map((folder) =>
            folder.id === folderId ? { ...folder, noteCount: Math.max(0, (folder.noteCount || 0) - 1) } : folder
          )
        );
      }
    },

    // 处理外部修改的文件
    handleFileChangedEvent: async (filePath, fullPath) => {
      const note = get().notes.find((n) => n.id === filePath);
      if (!note) return;

      const { selectedNoteId, savingNoteIds } = get();

      // ⭐ 保护1：跳过正在编辑的笔记（防止回退 bug）
      if (selectedNoteId === filePath) {
        console.log("[文件监听] 跳过正在编辑的笔记:", filePath);
        return;
      }

      // ⭐ 保护2：跳过正在保存的笔记（防止循环）
      if (savingNoteIds.has(filePath)) {
        console.log("[文件监听] 跳过正在保存的笔记:", filePath);
        return;
      }

      // ⭐ 保护3：跳过最近被我们保存的笔记（防止误触发）
      // 文件监听器可能在写入完成后的几百毫秒内才触发
      if (wasRecentlySaved(filePath)) {
        console.log("[文件监听] 跳过最近保存的笔记:", filePath);
        return;
      }

      // 只处理外部修改（比如其他程序修改的文件）
      const content = await handleFileChanged(filePath, fullPath);
      if (!content) return;

      console.log("[文件监听] 处理外部修改:", filePath);

      // 更新笔记内容（不更新编辑器内容，因为不是当前编辑的笔记）
      set((state) => {
        const targetNote = state.notes.find((n) => n.id === filePath);
        if (targetNote) {
          targetNote.content = content;
          targetNote.updatedAt = new Date().toISOString();
        }
      });
    },

    setNotePlaying: (noteId, isPlaying) => {
      set((state) => {
        if (isPlaying && !state.playingNoteIds.includes(noteId)) {
          state.playingNoteIds.push(noteId);
        } else if (!isPlaying && state.playingNoteIds.includes(noteId)) {
          state.playingNoteIds = state.playingNoteIds.filter((id) => id !== noteId);
        }
      });
    }
  }))
);
