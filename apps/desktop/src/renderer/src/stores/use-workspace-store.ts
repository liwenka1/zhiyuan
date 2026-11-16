import { create } from "zustand";
import { hasBackgroundSaves, waitForBackgroundSaves } from "./note-store/operation-guard";

interface WorkspaceStore {
  // 状态
  workspacePath: string | null;
  pendingFilePath: string | null;
  isLoading: boolean;
  revision: number;

  // 操作方法
  setWorkspacePath: (path: string | null) => Promise<void>;
  setPendingFilePath: (path: string | null) => void;
  setLoading: (loading: boolean) => void;
}

let workspaceRequest = 0;

function isPendingFileInWorkspace(filePath: string | null, workspacePath: string | null): boolean {
  if (!filePath || !workspacePath) return false;
  const normalize = (value: string) => {
    const normalized = value.replaceAll("\\", "/").replace(/\/+$/, "");
    return /^[a-z]:(?:\/|$)/i.test(normalized) || normalized.startsWith("//") ? normalized.toLowerCase() : normalized;
  };
  return normalize(filePath).startsWith(`${normalize(workspacePath)}/`);
}

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  // 初始状态
  workspacePath: null,
  pendingFilePath: null,
  isLoading: false,
  revision: 0,

  // 操作方法
  setWorkspacePath: async (path) => {
    const request = ++workspaceRequest;
    let deferredFilePath: string | null | undefined;
    // Keep the source identity and editor writable until publishing has committed its association.
    while (get().workspacePath !== path && hasBackgroundSaves()) {
      if (deferredFilePath === undefined) {
        deferredFilePath = get().pendingFilePath;
        // The old root can contain the requested nested root; do not let its selection effect consume this request.
        if (deferredFilePath !== null) set({ pendingFilePath: null });
      }
      await waitForBackgroundSaves();
      if (request !== workspaceRequest) return;
    }
    if (request !== workspaceRequest) return;
    // With no publication in flight this remains synchronous, before React can dispatch old-editor events.
    set((state) => {
      const requestedFilePath = deferredFilePath === undefined ? state.pendingFilePath : deferredFilePath;
      const pendingFilePath = isPendingFileInWorkspace(requestedFilePath, path) ? requestedFilePath : null;
      return state.workspacePath === path
        ? state.pendingFilePath === pendingFilePath
          ? state
          : { pendingFilePath }
        : { workspacePath: path, pendingFilePath, isLoading: path !== null, revision: state.revision + 1 };
    });
  },
  setPendingFilePath: (path) => set({ pendingFilePath: path }),
  setLoading: (loading) => set({ isLoading: loading })
}));
