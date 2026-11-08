import { create } from "zustand";

interface WorkspaceStore {
  // 状态
  workspacePath: string | null;
  pendingFilePath: string | null;
  isLoading: boolean;

  // 操作方法
  setWorkspacePath: (path: string | null) => void;
  setPendingFilePath: (path: string | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useWorkspaceStore = create<WorkspaceStore>((set) => ({
  // 初始状态
  workspacePath: null,
  pendingFilePath: null,
  isLoading: false,

  // 操作方法
  setWorkspacePath: (path) => set({ workspacePath: path }),
  setPendingFilePath: (path) => set({ pendingFilePath: path }),
  setLoading: (loading) => set({ isLoading: loading })
}));
