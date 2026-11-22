import { captureNoteLoadSnapshot } from "@/stores/note-store/loaders";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useNoteStore, useFolderStore, useWorkspaceStore } from "@/stores";
import { flushAllDebouncedSaves } from "@/stores/note-store/persistence";
import { isEditingBlocked, useOperationStore, waitForFileOperations } from "@/stores/note-store/operation-guard";
import { normalizeWorkspacePath } from "@/lib/workspace-paths";
import { workspaceIpc, fileIpc, folderIpc } from "@/ipc";
import i18n from "@/lib/i18n";

/**
 * 工作区初始化 Hook
 * 负责：
 * - 扫描并加载当前工作区内容（workspacePath 由 App.tsx 或 WelcomePage 设置）
 * - 监听文件系统变化
 */
export function useWorkspaceInit() {
  const loadFromFileSystem = useNoteStore((state) => state.loadFromFileSystem);
  const notes = useNoteStore((state) => state.notes);
  const selectNote = useNoteStore((state) => state.selectNote);
  const setFolders = useFolderStore((state) => state.setFolders);
  const workspacePath = useWorkspaceStore((state) => state.workspacePath);
  const isLoading = useWorkspaceStore((state) => state.isLoading);
  const setLoading = useWorkspaceStore((state) => state.setLoading);
  const setWorkspacePath = useWorkspaceStore((state) => state.setWorkspacePath);
  const pendingFilePaths = useWorkspaceStore((state) => state.pendingFilePaths);
  const setPendingFilePaths = useWorkspaceStore((state) => state.setPendingFilePaths);
  const previousWorkspacePathRef = useRef<string | null>(null);
  const scanGenerationRef = useRef(0);
  const pendingOpenLoadRef = useRef<{ paths: string[]; loading: boolean } | null>(null);

  // workspacePath 已由 App.tsx 设置，这里只负责扫描和加载工作区内容
  useEffect(() => {
    const scanGeneration = ++scanGenerationRef.current;
    if (!workspacePath) return;
    setLoading(true);

    const loadWorkspace = async () => {
      let previousWorkspacePath: string | null = null;
      let flushFailed = false;
      try {
        previousWorkspacePath = previousWorkspacePathRef.current;
        await waitForFileOperations();
        if (previousWorkspacePath && previousWorkspacePath !== workspacePath) {
          try {
            await flushAllDebouncedSaves(useNoteStore.getState);
          } catch (error) {
            flushFailed = true;
            throw error;
          }
        }
        if (
          scanGeneration !== scanGenerationRef.current ||
          useWorkspaceStore.getState().workspacePath !== workspacePath
        )
          return;
        const beforeScan = captureNoteLoadSnapshot(useNoteStore.getState);
        const data = await workspaceIpc.scan(workspacePath);
        if (
          scanGeneration !== scanGenerationRef.current ||
          useWorkspaceStore.getState().workspacePath !== workspacePath
        ) {
          return;
        }
        if (!data) {
          setPendingFilePaths([]);
          if (previousWorkspacePath && previousWorkspacePath !== workspacePath) {
            previousWorkspacePathRef.current = previousWorkspacePath;
            setWorkspacePath(previousWorkspacePath);
          } else {
            previousWorkspacePathRef.current = null;
            setWorkspacePath(null);
          }
          return;
        }
        setFolders(data.folders);
        await loadFromFileSystem(data, workspacePath, beforeScan);
        if (
          scanGeneration === scanGenerationRef.current &&
          useWorkspaceStore.getState().workspacePath === workspacePath
        ) {
          previousWorkspacePathRef.current = workspacePath;
        }
      } catch (error) {
        if (
          scanGeneration !== scanGenerationRef.current ||
          useWorkspaceStore.getState().workspacePath !== workspacePath
        ) {
          return;
        }
        setPendingFilePaths([]);
        if (previousWorkspacePath && previousWorkspacePath !== workspacePath) {
          previousWorkspacePathRef.current = previousWorkspacePath;
          setWorkspacePath(previousWorkspacePath);
        } else {
          previousWorkspacePathRef.current = null;
          setWorkspacePath(null);
        }
        if (flushFailed && error instanceof Error) {
          toast.error(`${i18n.t("note:errors.saveNoteFailed")}: ${error.message}`);
        } else {
          toast.error(i18n.t("note:errors.initWorkspaceFailed"));
        }
      } finally {
        if (
          scanGeneration === scanGenerationRef.current &&
          useWorkspaceStore.getState().workspacePath === workspacePath
        ) {
          setLoading(false);
        }
      }
    };

    loadWorkspace();
  }, [workspacePath, loadFromFileSystem, setFolders, setPendingFilePaths, setWorkspacePath, setLoading]);

  // 扫描结束后补读未被索引的目标，再按请求顺序打开笔记。
  useEffect(() => {
    if (isLoading || !workspacePath || pendingFilePaths.length === 0) return;
    const selectPendingNotes = () => {
      const current = useWorkspaceStore.getState();
      if (
        current.isLoading ||
        current.workspacePath !== workspacePath ||
        current.pendingFilePaths !== pendingFilePaths ||
        isEditingBlocked()
      ) {
        return;
      }
      const noteStore = useNoteStore.getState();
      const notesByPath = new Map(
        noteStore.notes.filter((note) => note.filePath).map((note) => [normalizeWorkspacePath(note.filePath!), note])
      );
      const pendingLoad = pendingOpenLoadRef.current;
      if (pendingLoad?.paths === pendingFilePaths) {
        if (pendingLoad.loading) return;
      } else {
        const missing = pendingFilePaths.filter((filePath) => !notesByPath.has(normalizeWorkspacePath(filePath)));
        if (missing.length > 0) {
          const load = { paths: pendingFilePaths, loading: true };
          pendingOpenLoadRef.current = load;
          const rootLength = normalizeWorkspacePath(workspacePath).length;
          void Promise.allSettled(
            missing.map((filePath) => {
              const relativePath = normalizeWorkspacePath(filePath).slice(rootLength + 1);
              return noteStore.handleFileAddedEvent(relativePath, filePath);
            })
          ).then(() => {
            load.loading = false;
            selectPendingNotes();
          });
          return;
        }
      }

      const remaining: string[] = [];
      for (const filePath of pendingFilePaths) {
        const target = notesByPath.get(normalizeWorkspacePath(filePath));
        if (!target) continue;
        if (useNoteStore.getState().selectedNoteId !== target.id) selectNote(target.id);
        if (useNoteStore.getState().selectedNoteId !== target.id) remaining.push(filePath);
      }
      if (remaining.length !== pendingFilePaths.length) {
        pendingOpenLoadRef.current = { paths: remaining, loading: false };
        setPendingFilePaths(remaining);
      }
    };
    const unsubscribe = useOperationStore.subscribe(selectPendingNotes);
    selectPendingNotes();
    return unsubscribe;
  }, [isLoading, notes, pendingFilePaths, selectNote, setPendingFilePaths, workspacePath]);

  // 监听文件系统变化
  useEffect(() => {
    const isCurrentWorkspaceEvent = (relativePath: string, fullPath: string) => {
      const activeRoot = useWorkspaceStore.getState().workspacePath;
      return activeRoot && normalizeWorkspacePath(fullPath) === `${normalizeWorkspacePath(activeRoot)}/${relativePath}`;
    };
    // 获取处理方法
    const handleFileAdded = useNoteStore.getState().handleFileAddedEvent;
    const handleFileDeleted = useNoteStore.getState().handleFileDeletedEvent;
    const handleFileChanged = useNoteStore.getState().handleFileChangedEvent;
    const handleFolderAdded = useFolderStore.getState().handleFolderAdded;
    const handleFolderDeleted = useFolderStore.getState().handleFolderDeleted;

    // 注册文件监听器
    const unsubscribeAdded = fileIpc.onAdded((data) => {
      if (isCurrentWorkspaceEvent(data.filePath, data.fullPath)) handleFileAdded(data.filePath, data.fullPath);
    });

    const unsubscribeDeleted = fileIpc.onDeleted((data) => {
      if (isCurrentWorkspaceEvent(data.filePath, data.fullPath)) handleFileDeleted(data.filePath);
    });

    const unsubscribeChanged = fileIpc.onChanged((data) => {
      if (isCurrentWorkspaceEvent(data.filePath, data.fullPath)) handleFileChanged(data.filePath, data.fullPath);
    });

    // 注册文件夹监听器
    const unsubscribeFolderAdded = folderIpc.onAdded((data) => {
      if (isCurrentWorkspaceEvent(data.folderPath, data.fullPath)) handleFolderAdded(data.folderPath, data.fullPath);
    });

    const unsubscribeFolderDeleted = folderIpc.onDeleted((data) => {
      if (isCurrentWorkspaceEvent(data.folderPath, data.fullPath)) handleFolderDeleted(data.folderPath);
    });

    // 清理监听器
    return () => {
      unsubscribeAdded();
      unsubscribeDeleted();
      unsubscribeChanged();
      unsubscribeFolderAdded();
      unsubscribeFolderDeleted();
    };
  }, []);
}
