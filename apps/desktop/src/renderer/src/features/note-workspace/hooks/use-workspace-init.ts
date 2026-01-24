import { useEffect } from "react";
import { useNoteStore, useWorkspaceStore } from "@/stores";

/**
 * 工作区初始化 Hook
 * 负责：
 * - 初始化工作区（加载或创建）
 * - 监听文件系统变化
 */
export function useWorkspaceInit() {
  const loadFromFileSystem = useNoteStore((state) => state.loadFromFileSystem);
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
          loadFromFileSystem(data);
        } else {
          // 没有保存的工作区，创建默认工作区
          const defaultWorkspacePath = await window.api.workspace.createDefault();
          setWorkspacePath(defaultWorkspacePath);
          const data = await window.api.workspace.scan(defaultWorkspacePath);
          loadFromFileSystem(data);
        }
      } catch (error) {
        console.error("初始化工作区失败:", error);
      }
    };

    initWorkspace();
  }, [loadFromFileSystem, setWorkspacePath]);

  // 监听文件系统变化
  useEffect(() => {
    // 获取处理方法
    const handleFileAdded = useNoteStore.getState().handleFileAdded;
    const handleFileDeleted = useNoteStore.getState().handleFileDeleted;
    const handleFileChanged = useNoteStore.getState().handleFileChanged;
    const handleFolderAdded = useNoteStore.getState().handleFolderAdded;
    const handleFolderDeleted = useNoteStore.getState().handleFolderDeleted;

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
}
