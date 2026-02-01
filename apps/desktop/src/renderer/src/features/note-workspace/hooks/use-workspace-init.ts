import { useEffect } from "react";
import { useNoteStore, useFolderStore, useWorkspaceStore } from "@/stores";
import { clearAllDebouncedSaves } from "@/stores/use-note-store";

/**
 * 工作区初始化 Hook
 * 负责：
 * - 初始化工作区（加载或创建）
 * - 监听文件系统变化
 * - 窗口关闭时保存
 */
export function useWorkspaceInit() {
  const loadFromFileSystem = useNoteStore((state) => state.loadFromFileSystem);
  const setFolders = useFolderStore((state) => state.setFolders);
  const setWorkspacePath = useWorkspaceStore((state) => state.setWorkspacePath);

  // 初始化：检查是否有保存的工作区，或创建默认工作区
  useEffect(() => {
    const initWorkspace = async () => {
      try {
        // 尝试获取上次打开的工作区
        const savedWorkspacePath = await window.api.workspace.getCurrent();

        if (savedWorkspacePath) {
          // 有保存的工作区，加载它
          setWorkspacePath(savedWorkspacePath);
          const data = await window.api.workspace.scan(savedWorkspacePath);
          setFolders(data.folders);
          loadFromFileSystem(data);
        } else {
          // 没有保存的工作区，创建默认工作区
          const defaultWorkspacePath = await window.api.workspace.createDefault();
          setWorkspacePath(defaultWorkspacePath);
          const data = await window.api.workspace.scan(defaultWorkspacePath);
          setFolders(data.folders);
          loadFromFileSystem(data);
        }
      } catch (error) {
        console.error("初始化工作区失败:", error);
      }
    };

    initWorkspace();
  }, [loadFromFileSystem, setFolders, setWorkspacePath]);

  // 监听文件系统变化
  useEffect(() => {
    // 获取处理方法
    const handleFileAdded = useNoteStore.getState().handleFileAddedEvent;
    const handleFileDeleted = useNoteStore.getState().handleFileDeletedEvent;
    const handleFileChanged = useNoteStore.getState().handleFileChangedEvent;
    const handleFolderAdded = useFolderStore.getState().handleFolderAdded;
    const handleFolderDeleted = useFolderStore.getState().handleFolderDeleted;

    // 注册文件监听器
    const unsubscribeAdded = window.api.file.onAdded((data) => {
      handleFileAdded(data.filePath, data.fullPath);
    });

    const unsubscribeDeleted = window.api.file.onDeleted((data) => {
      handleFileDeleted(data.filePath);
    });

    const unsubscribeChanged = window.api.file.onChanged((data) => {
      handleFileChanged(data.filePath, data.fullPath);
    });

    // 注册文件夹监听器
    const unsubscribeFolderAdded = window.api.folder.onAdded((data) => {
      handleFolderAdded(data.folderPath, data.fullPath);
    });

    const unsubscribeFolderDeleted = window.api.folder.onDeleted((data) => {
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
