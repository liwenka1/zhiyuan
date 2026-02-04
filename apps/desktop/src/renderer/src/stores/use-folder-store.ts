import { create } from "zustand";
import { produce } from "immer";
import { Folder } from "@/types";
import { useWorkspaceStore } from "./use-workspace-store";
import { folderIpc } from "@/ipc";
import { toast } from "sonner";
import i18n from "@/lib/i18n";

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
      toast.error(i18n.t("note:errors.noWorkspace"));
      return;
    }

    try {
      const folderPath = `${workspacePath}/${name}`;

      // 在文件系统中创建文件夹
      await folderIpc.create(folderPath);

      const newFolder: Folder = {
        id: name, // 使用文件夹名作为 ID
        name,
        path: folderPath,
        noteCount: 0,
        isRss: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      set(
        produce((draft) => {
          draft.folders.push(newFolder);
        })
      );
    } catch {
      toast.error(i18n.t("note:errors.createFolderFailed"));
    }
  },

  deleteFolder: (folderId) => {
    set(
      produce((draft) => {
        draft.folders = draft.folders.filter((f) => f.id !== folderId);
        // 如果删除的是当前选中的文件夹，清空选中状态
        if (draft.selectedFolderId === folderId) {
          draft.selectedFolderId = null;
        }
      })
    );
  },

  renameFolder: async (folderId, newName) => {
    const workspacePath = useWorkspaceStore.getState().workspacePath;
    const folder = get().folders.find((f) => f.id === folderId);

    if (!workspacePath || !folder?.path) {
      toast.error(i18n.t("note:errors.noWorkspace"));
      return;
    }

    try {
      // 构建新的文件夹路径
      const newFolderPath = `${workspacePath}/${newName}`;

      // 在文件系统中重命名文件夹
      await folderIpc.rename(folder.path, newFolderPath);

      // 更新 store 中的文件夹信息
      set(
        produce((draft) => {
          const targetFolder = draft.folders.find((f) => f.id === folderId);
          if (targetFolder) {
            targetFolder.id = newName; // 使用新名称作为 ID
            targetFolder.name = newName;
            targetFolder.path = newFolderPath;
            targetFolder.updatedAt = new Date().toISOString();
          }

          // 如果重命名的是当前选中的文件夹，更新选中状态
          if (draft.selectedFolderId === folderId) {
            draft.selectedFolderId = newName;
          }
        })
      );
    } catch (error) {
      toast.error(i18n.t("note:errors.renameFolderFailed"));
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
    set(
      produce((draft) => {
        draft.folders.push(newFolder);
      })
    );
  },

  // 处理外部删除的文件夹
  handleFolderDeleted: (folderPath) => {
    const folder = get().folders.find((f) => f.id === folderPath);
    if (!folder) return;

    // 从文件夹列表中移除
    set(
      produce((draft) => {
        draft.folders = draft.folders.filter((f) => f.id !== folderPath);
        if (draft.selectedFolderId === folderPath) {
          draft.selectedFolderId = null;
        }
      })
    );
  }
}));
