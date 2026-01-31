import { create } from "zustand";
import { Folder } from "@/types";
import { useWorkspaceStore } from "./use-workspace-store";

interface FolderStore {
  // 状态
  folders: Folder[];
  selectedFolderId: string | null;

  // 操作方法
  setFolders: (folders: Folder[]) => void;
  selectFolder: (folderId: string | null) => void;
  createFolder: (name: string) => Promise<void>;
  deleteFolder: (folderId: string) => void;
  renameFolder: (folderId: string, newName: string) => Promise<void>;

  // 文件夹监听处理
  handleFolderAdded: (folderPath: string, fullPath: string) => void;
  handleFolderDeleted: (folderPath: string) => void;
}

export const useFolderStore = create<FolderStore>((set, get) => ({
  // 初始状态
  folders: [],
  selectedFolderId: null,

  // 操作方法
  setFolders: (folders) => set({ folders }),

  selectFolder: (folderId) => {
    set({
      selectedFolderId: folderId
    });
  },

  createFolder: async (name) => {
    // 从工作区 store 获取当前工作区路径
    const workspacePath = useWorkspaceStore.getState().workspacePath;

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
        isRss: false,
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
    const workspacePath = useWorkspaceStore.getState().workspacePath;
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
        selectedFolderId: state.selectedFolderId === folderId ? newName : state.selectedFolderId
      }));
    } catch (error) {
      console.error("重命名文件夹失败:", error);
      throw error;
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
      isRss: false,
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

    // 从文件夹列表中移除
    set((state) => ({
      folders: state.folders.filter((f) => f.id !== folderPath),
      selectedFolderId: state.selectedFolderId === folderPath ? null : state.selectedFolderId
    }));
  }
}));
