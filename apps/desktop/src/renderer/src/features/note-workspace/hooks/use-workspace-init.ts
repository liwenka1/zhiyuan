import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useNoteStore, useFolderStore, useWorkspaceStore } from "@/stores";
import { flushAllDebouncedSaves } from "@/stores/note-store/persistence";
import { workspaceIpc, fileIpc, folderIpc } from "@/ipc";

/**
 * 工作区初始化 Hook
 * 负责：
 * - 扫描并加载当前工作区内容（workspacePath 由 App.tsx 或 WelcomePage 设置）
 * - 监听文件系统变化
 * - 窗口关闭时保存
 */
export function useWorkspaceInit() {
  const { t } = useTranslation("note");
  const loadFromFileSystem = useNoteStore((state) => state.loadFromFileSystem);
  const notes = useNoteStore((state) => state.notes);
  const selectNote = useNoteStore((state) => state.selectNote);
  const setFolders = useFolderStore((state) => state.setFolders);
  const workspacePath = useWorkspaceStore((state) => state.workspacePath);
  const setWorkspacePath = useWorkspaceStore((state) => state.setWorkspacePath);
  const pendingFilePath = useWorkspaceStore((state) => state.pendingFilePath);
  const setPendingFilePath = useWorkspaceStore((state) => state.setPendingFilePath);
  const previousWorkspacePathRef = useRef<string | null>(null);
  const scanGenerationRef = useRef(0);

  // workspacePath 已由 App.tsx 设置，这里只负责扫描和加载工作区内容
  useEffect(() => {
    const scanGeneration = ++scanGenerationRef.current;
    if (!workspacePath) return;

    const loadWorkspace = async () => {
      let previousWorkspacePath: string | null = null;
      let flushFailed = false;
      try {
        previousWorkspacePath = previousWorkspacePathRef.current;
        previousWorkspacePathRef.current = workspacePath;
        if (previousWorkspacePath && previousWorkspacePath !== workspacePath) {
          try {
            await flushAllDebouncedSaves(useNoteStore.getState);
          } catch (error) {
            flushFailed = true;
            throw error;
          }
        }
        const data = await workspaceIpc.scan(workspacePath);
        if (
          scanGeneration !== scanGenerationRef.current ||
          useWorkspaceStore.getState().workspacePath !== workspacePath
        ) {
          return;
        }
        if (!data) {
          setPendingFilePath(null);
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
        await loadFromFileSystem(data, workspacePath);
      } catch (error) {
        if (
          scanGeneration !== scanGenerationRef.current ||
          useWorkspaceStore.getState().workspacePath !== workspacePath
        ) {
          return;
        }
        setPendingFilePath(null);
        if (previousWorkspacePath && previousWorkspacePath !== workspacePath) {
          previousWorkspacePathRef.current = previousWorkspacePath;
          setWorkspacePath(previousWorkspacePath);
        }
        if (flushFailed && error instanceof Error) {
          toast.error(`${t("errors.saveNoteFailed")}: ${error.message}`);
        } else {
          toast.error(t("errors.initWorkspaceFailed"));
        }
      }
    };

    loadWorkspace();
  }, [workspacePath, loadFromFileSystem, setFolders, setPendingFilePath, setWorkspacePath, t]);

  // 扫描完成后再根据待打开路径选中笔记，避免 pendingFilePath 清空触发第二次扫描。
  useEffect(() => {
    if (!workspacePath || !pendingFilePath) return;
    const normalize = (value: string) => value.replaceAll("\\", "/").replace(/\/$/, "");
    const target = notes.find((note) => note.filePath && normalize(note.filePath) === normalize(pendingFilePath));
    if (!target) return;
    window.setTimeout(() => selectNote(target.id), 0);
    setPendingFilePath(null);
  }, [notes, pendingFilePath, selectNote, setPendingFilePath, workspacePath]);

  // 监听文件系统变化
  useEffect(() => {
    // 获取处理方法
    const handleFileAdded = useNoteStore.getState().handleFileAddedEvent;
    const handleFileDeleted = useNoteStore.getState().handleFileDeletedEvent;
    const handleFileChanged = useNoteStore.getState().handleFileChangedEvent;
    const handleFolderAdded = useFolderStore.getState().handleFolderAdded;
    const handleFolderDeleted = useFolderStore.getState().handleFolderDeleted;

    // 注册文件监听器
    const unsubscribeAdded = fileIpc.onAdded((data) => {
      handleFileAdded(data.filePath, data.fullPath);
    });

    const unsubscribeDeleted = fileIpc.onDeleted((data) => {
      handleFileDeleted(data.filePath);
    });

    const unsubscribeChanged = fileIpc.onChanged((data) => {
      handleFileChanged(data.filePath, data.fullPath);
    });

    // 注册文件夹监听器
    const unsubscribeFolderAdded = folderIpc.onAdded((data) => {
      handleFolderAdded(data.folderPath, data.fullPath);
    });

    const unsubscribeFolderDeleted = folderIpc.onDeleted((data) => {
      handleFolderDeleted(data.folderPath);
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

  // 主进程在真正关闭窗口前等待 renderer 完成保存。
  useEffect(() => {
    const handlePrepareClose = async () => {
      try {
        const { selectedNoteId, editorContent } = useNoteStore.getState();
        if (selectedNoteId && editorContent !== undefined) {
          await useNoteStore.getState().saveNoteToFileSystem(selectedNoteId, editorContent);
        }
        await flushAllDebouncedSaves(useNoteStore.getState);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        toast.error(`${t("errors.saveNoteFailed")}: ${message}`);
      } finally {
        await window.api.window.readyToClose().catch(() => {});
      }
    };

    return window.api.window.onPrepareClose(() => {
      void handlePrepareClose();
    });
  }, [t]);
}
