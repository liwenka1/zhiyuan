import { create } from "zustand";
import { normalizeWorkspacePath } from "@/lib/workspace-paths";
import { hasBackgroundSaves, waitForBackgroundSaves } from "./note-store/operation-guard";

interface WorkspaceStore {
  // 状态
  workspacePath: string | null;
  pendingFilePaths: string[];
  isLoading: boolean;
  revision: number;

  // 操作方法
  setWorkspacePath: (path: string | null, filePath?: string | null) => Promise<void>;
  setPendingFilePaths: (paths: string[]) => void;
  setLoading: (loading: boolean) => void;
}

let workspaceRequest: Pick<WorkspaceStore, "workspacePath" | "pendingFilePaths"> | undefined;

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  // 初始状态
  workspacePath: null,
  pendingFilePaths: [],
  isLoading: false,
  revision: 0,

  // 操作方法
  setWorkspacePath: async (path, filePath = null) => {
    const current = get();
    const queuedPaths =
      workspaceRequest?.workspacePath === path
        ? workspaceRequest.pendingFilePaths
        : current.workspacePath === path
          ? current.pendingFilePaths
          : [];
    const requestedPath = filePath ? normalizeWorkspacePath(filePath) : null;
    const pendingFilePaths =
      path && filePath && requestedPath?.startsWith(`${normalizeWorkspacePath(path)}/`)
        ? [...queuedPaths.filter((queued) => normalizeWorkspacePath(queued) !== requestedPath), filePath]
        : queuedPaths;
    const request = { workspacePath: path, pendingFilePaths };
    workspaceRequest = request;
    // Keep the source identity and editor writable until publishing has committed its association.
    while (get().workspacePath !== path && hasBackgroundSaves()) {
      await waitForBackgroundSaves();
      if (request !== workspaceRequest) return;
    }
    workspaceRequest = undefined;
    // With no publication in flight this remains synchronous, before React can dispatch old-editor events.
    set((state) => {
      return state.workspacePath === path
        ? state.pendingFilePaths === pendingFilePaths
          ? state
          : { pendingFilePaths }
        : { workspacePath: path, pendingFilePaths, isLoading: path !== null, revision: state.revision + 1 };
    });
  },
  setPendingFilePaths: (paths) => set({ pendingFilePaths: paths }),
  setLoading: (loading) => set({ isLoading: loading })
}));
