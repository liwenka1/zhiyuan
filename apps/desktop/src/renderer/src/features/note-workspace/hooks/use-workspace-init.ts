import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useNoteStore, useFolderStore, useWorkspaceStore } from "@/stores";
import { clearAllDebouncedSaves } from "@/stores/use-note-store";
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
  const setFolders = useFolderStore((state) => state.setFolders);
  const workspacePath = useWorkspaceStore((state) => state.workspacePath);

  // workspacePath 已由 App.tsx 设置，这里只负责扫描和加载工作区内容
  useEffect(() => {
    if (!workspacePath) return;

    const loadWorkspace = async () => {
      try {
        const data = await workspaceIpc.scan(workspacePath);
        setFolders(data.folders);
        loadFromFileSystem(data);
      } catch {
        toast.error(t("errors.initWorkspaceFailed"));
      }
    };

    loadWorkspace();
  }, [workspacePath, loadFromFileSystem, setFolders, t]);

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

  // 窗口关闭时保存当前笔记
  useEffect(() => {
    const handleBeforeUnload = () => {
      const { selectedNoteId, editorContent } = useNoteStore.getState();

      if (selectedNoteId && editorContent) {
        // 清除所有防抖定时器
        clearAllDebouncedSaves();

        // 立即保存当前笔记
        const note = useNoteStore.getState().notes.find((n) => n.id === selectedNoteId);
        if (note?.filePath) {
          useNoteStore.getState().saveNoteToFileSystem(selectedNoteId, editorContent);
        }
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);
}
