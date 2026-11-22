import { beginFileOperation, isEditingBlocked, isPublishingPath } from "./note-store/operation-guard";
import { create } from "zustand";
import { produce } from "immer";
import { Folder } from "@/types";
import { useWorkspaceStore } from "./use-workspace-store";
import { folderIpc, configIpc, watcherIpc, fileIpc } from "@/ipc";
import { toast } from "sonner";
import i18n from "@/lib/i18n";
import { useNoteStore } from "./note-store";
import { setLastSavedContent } from "./note-store/persistence";
import { saveNoteBeforePathChange } from "./note-store/path-change-persistence";
import { parseGitHubMetadata } from "@/lib/github-metadata";
import { isValidWorkspaceFolderName } from "@shared";

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
  setFolders: (folders) =>
    set((state) => ({
      folders,
      selectedFolderId:
        state.selectedFolderId && folders.some((folder) => folder.id === state.selectedFolderId)
          ? state.selectedFolderId
          : null
    })),

  selectFolder: (folderId) => {
    set({
      selectedFolderId: folderId
    });
  },

  createFolder: async (name) => {
    if (useWorkspaceStore.getState().isLoading || isEditingBlocked()) return;
    // 从工作区 store 获取当前工作区路径
    const workspacePath = useWorkspaceStore.getState().workspacePath;

    if (!workspacePath) {
      toast.error(i18n.t("note:errors.noWorkspace"));
      return;
    }

    // 如果名称为空，使用默认名称
    let folderName = name.trim();
    if (!folderName) {
      const defaultFolderName = i18n.t("note:defaultFolderName");
      const existingFolders = get().folders;
      let maxNum = 0;
      const defaultPattern = new RegExp(`^${defaultFolderName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} (\\d+)$`);
      for (const f of existingFolders) {
        const match = f.name.match(defaultPattern);
        if (match) {
          maxNum = Math.max(maxNum, parseInt(match[1], 10));
        }
      }
      folderName = `${defaultFolderName} ${maxNum + 1}`;
    }

    if (!isValidWorkspaceFolderName(folderName)) {
      toast.error(i18n.t("note:errors.invalidName"));
      return;
    }

    // 检查是否已存在同名文件夹
    const existing = get().folders.find((f) => f.id === folderName || f.name === folderName);
    if (existing) {
      toast.error(i18n.t("note:errors.folderAlreadyExists"));
      return;
    }

    try {
      const folderSeparator = workspacePath.includes("\\") ? "\\" : "/";
      const folderPath = `${workspacePath}${folderSeparator}${folderName}`;

      await watcherIpc.pause(workspacePath);
      try {
        if (!isCurrentWorkspaceReady(workspacePath)) return;
        // 在文件系统中创建文件夹
        await folderIpc.create(folderPath);
      } finally {
        await watcherIpc.resume(workspacePath);
      }
      if (!isCurrentWorkspaceReady(workspacePath)) return;

      get().handleFolderAdded(folderName, folderPath);
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
    if (useWorkspaceStore.getState().isLoading || isEditingBlocked()) return;
    const workspacePath = useWorkspaceStore.getState().workspacePath;
    const folder = get().folders.find((f) => f.id === folderId);

    if (!workspacePath || !folder?.path) {
      toast.error(i18n.t("note:errors.noWorkspace"));
      return;
    }

    let didPause = false;
    let releaseOperation: (() => void) | null = null;
    try {
      const normalizedName = newName.trim();
      if (!isValidWorkspaceFolderName(normalizedName)) {
        toast.error(i18n.t("note:errors.invalidName"));
        return;
      }
      if (get().folders.some((item) => item.id !== folderId && item.name === normalizedName)) {
        toast.error(i18n.t("note:errors.folderAlreadyExists"));
        return;
      }
      // 构建新的文件夹路径
      const separator = workspacePath.includes("\\") ? "\\" : "/";
      const parentFolderPath = folder.path.split(/[\\/]/).slice(0, -1).join(separator);
      const newFolderPath = `${parentFolderPath}${separator}${normalizedName}`;
      const oldFolderPathPrefix = `${folder.path}${separator}`;
      const newFolderPathPrefix = `${newFolderPath}${separator}`;
      const oldNotePrefix = `${folderId}/`;
      const folderParentId = folderId.split("/").slice(0, -1).join("/");
      const newFolderId = folderParentId ? `${folderParentId}/${normalizedName}` : normalizedName;
      const newNotePrefix = `${newFolderId}/`;
      releaseOperation = beginFileOperation({ workspacePath, path: folder.path, includeDescendants: true });
      if (!releaseOperation) {
        if (isPublishingPath(workspacePath, folder.path, true)) toast.error(i18n.t("note:github.publishInProgress"));
        return;
      }
      const affectedNotes = useNoteStore
        .getState()
        .notes.filter((note) => note.filePath?.startsWith(oldFolderPathPrefix));
      const savedContents = new Map<string, string>();
      for (const note of affectedNotes) {
        if (!isCurrentWorkspaceReady(workspacePath)) return;
        const savedContent = await saveNoteBeforePathChange(useNoteStore.getState, note.id);
        if (savedContent !== undefined) savedContents.set(note.id, savedContent);
      }
      if (!isCurrentWorkspaceReady(workspacePath)) return;

      await watcherIpc.pause(workspacePath);
      didPause = true;
      if (!isCurrentWorkspaceReady(workspacePath)) return;

      // 在文件系统中重命名文件夹
      await folderIpc.rename(folder.path, newFolderPath);
      if (!isCurrentWorkspaceReady(workspacePath)) return;

      // 更新 store 中的文件夹信息
      set(
        produce((draft) => {
          const renameFolderId = (id: string) =>
            id === folderId || id.startsWith(oldNotePrefix) ? `${newFolderId}${id.slice(folderId.length)}` : id;
          draft.folders = draft.folders.map((item) => {
            if (item.id !== folderId && !item.id.startsWith(oldNotePrefix)) return item;
            return {
              ...item,
              id: renameFolderId(item.id),
              name: renameFolderId(item.name),
              path:
                item.id === folderId
                  ? newFolderPath
                  : item.path?.startsWith(oldFolderPathPrefix)
                    ? `${newFolderPathPrefix}${item.path.slice(oldFolderPathPrefix.length)}`
                    : item.path,
              updatedAt: new Date().toISOString()
            };
          });

          // 如果重命名的是当前选中的文件夹，更新选中状态
          if (draft.selectedFolderId) draft.selectedFolderId = renameFolderId(draft.selectedFolderId);
        })
      );

      useNoteStore.setState((state) => {
        const renameNoteId = (noteId: string) =>
          noteId.startsWith(oldNotePrefix) ? `${newNotePrefix}${noteId.slice(oldNotePrefix.length)}` : noteId;

        return {
          notes: state.notes.map((note) => {
            if (note.folderId !== folderId && !note.folderId?.startsWith(oldNotePrefix)) return note;

            return {
              ...note,
              id: renameNoteId(note.id),
              filePath: note.filePath?.startsWith(oldFolderPathPrefix)
                ? `${newFolderPathPrefix}${note.filePath.slice(oldFolderPathPrefix.length)}`
                : note.filePath,
              folderId:
                note.folderId === folderId
                  ? newFolderId
                  : `${newNotePrefix}${note.folderId?.slice(oldNotePrefix.length) || ""}`,
              updatedAt: new Date().toISOString()
            };
          }),
          openNoteIds: state.openNoteIds.map(renameNoteId),
          playingNoteIds: state.playingNoteIds.map(renameNoteId),
          selectedNoteId: state.selectedNoteId ? renameNoteId(state.selectedNoteId) : state.selectedNoteId,
          savingNoteIds: new Set(Array.from(state.savingNoteIds).map(renameNoteId))
        };
      });

      for (const [noteId, content] of savedContents) {
        setLastSavedContent(`${newNotePrefix}${noteId.slice(oldNotePrefix.length)}`, content);
      }

      const pinnedNoteIds = useNoteStore
        .getState()
        .notes.filter((note) => note.isPinned)
        .map((note) => note.id);
      await configIpc.setPinnedNotes(workspacePath, pinnedNoteIds);

      const movedNotes = useNoteStore.getState().notes.filter((note) => note.filePath?.startsWith(newFolderPathPrefix));
      const reads = await Promise.allSettled(movedNotes.map((note) => fileIpc.read(note.filePath!)));
      if (!isCurrentWorkspaceReady(workspacePath)) return;
      const contents = new Map<string, string>();
      reads.forEach((result, index) => {
        if (result.status === "fulfilled") contents.set(movedNotes[index].id, result.value.content);
      });
      useNoteStore.setState((state) => ({
        notes: state.notes.map((note) => {
          const content = contents.get(note.id);
          if (content === undefined) return note;
          return { ...note, content, github: parseGitHubMetadata(content) };
        }),
        editorContent: (state.selectedNoteId && contents.get(state.selectedNoteId)) ?? state.editorContent
      }));
      contents.forEach((content, noteId) => setLastSavedContent(noteId, content));
      const failedRead = reads.find((result) => result.status === "rejected");
      if (failedRead?.status === "rejected") throw failedRead.reason;
    } catch (error) {
      toast.error(i18n.t("note:errors.renameFolderFailed"));
      throw error;
    } finally {
      try {
        if (didPause) await watcherIpc.resume(workspacePath);
      } finally {
        releaseOperation?.();
      }
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

function isCurrentWorkspaceReady(workspacePath: string): boolean {
  const current = useWorkspaceStore.getState();
  return !current.isLoading && current.workspacePath === workspacePath;
}
