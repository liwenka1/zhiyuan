import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { NoteWorkspace } from "@/features/note-workspace";
import { WelcomePage } from "@/features/welcome";
import {
  useThemeStore,
  useViewStore,
  useWorkspaceStore,
  useNoteStore,
  useFolderStore,
  useExportThemeStore,
  useExportLayoutStore
} from "@/stores";
import { Toaster } from "@/components/ui/sonner";
import { PresentationView } from "@/features/editor";
import { workspaceIpc } from "@/ipc";

function App(): React.JSX.Element {
  const initTheme = useThemeStore((state) => state.initTheme);
  const cleanup = useThemeStore((state) => state.cleanup);
  const isPresentationMode = useViewStore((state) => state.isPresentationMode);
  const workspacePath = useWorkspaceStore((state) => state.workspacePath);
  const setWorkspacePath = useWorkspaceStore((state) => state.setWorkspacePath);
  const loadFromFileSystem = useNoteStore((state) => state.loadFromFileSystem);
  const selectNote = useNoteStore((state) => state.selectNote);
  const setFolders = useFolderStore((state) => state.setFolders);
  const [showPresentation, setShowPresentation] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // 打开文件夹（菜单触发）
  const handleMenuOpenFolder = useCallback(async () => {
    try {
      const selectedPath = await workspaceIpc.select();
      if (!selectedPath) return;

      const data = await workspaceIpc.scan(selectedPath);
      if (!data) return;

      setWorkspacePath(selectedPath);
      setFolders(data.folders);
      loadFromFileSystem(data);
    } catch {
      /* 静默处理 */
    }
  }, [setWorkspacePath, setFolders, loadFromFileSystem]);

  // 打开文件（菜单触发）
  const handleMenuOpenFile = useCallback(async () => {
    try {
      const result = await workspaceIpc.openFile();
      if (!result) return;

      const data = await workspaceIpc.scan(result.workspacePath);
      if (!data) return;

      setWorkspacePath(result.workspacePath);
      setFolders(data.folders);
      loadFromFileSystem(data);

      const fileName = result.filePath.split("/").pop() || "";
      const targetNote = data.notes.find((n) => n.fileName === fileName);
      if (targetNote) {
        setTimeout(() => selectNote(targetNote.id), 0);
      }
    } catch {
      /* 静默处理 */
    }
  }, [setWorkspacePath, setFolders, loadFromFileSystem, selectNote]);

  const initExportTheme = useExportThemeStore((state) => state.initExportTheme);
  const initExportLayout = useExportLayoutStore((state) => state.initExportLayout);

  // 初始化主题，组件卸载时清理监听器
  useEffect(() => {
    initTheme();
    return () => {
      cleanup();
    };
  }, [initTheme, cleanup]);

  // 初始化导出主题（独立 effect，避免触发 initTheme 的 cleanup 重跑）
  useEffect(() => {
    initExportTheme();
  }, [initExportTheme]);

  // 初始化导出布局配置（数据模型预热，暂不影响现有导出行为）
  useEffect(() => {
    initExportLayout();
  }, [initExportLayout]);

  // 监听菜单「打开文件夹/文件」事件（macOS 原生菜单 + Windows 自定义菜单栏）
  useEffect(() => {
    const unsubFolder = workspaceIpc.onMenuOpenFolder(handleMenuOpenFolder);
    const unsubFile = workspaceIpc.onMenuOpenFile(handleMenuOpenFile);

    // Windows 自定义菜单栏通过 DOM 事件触发
    const onDomOpenFolder = () => handleMenuOpenFolder();
    const onDomOpenFile = () => handleMenuOpenFile();
    window.addEventListener("app:menu-open-folder", onDomOpenFolder);
    window.addEventListener("app:menu-open-file", onDomOpenFile);

    return () => {
      unsubFolder();
      unsubFile();
      window.removeEventListener("app:menu-open-folder", onDomOpenFolder);
      window.removeEventListener("app:menu-open-file", onDomOpenFile);
    };
  }, [handleMenuOpenFolder, handleMenuOpenFile]);

  // Windows/Linux: Ctrl+O 打开文件夹
  useEffect(() => {
    const isMac = navigator.userAgent.toLowerCase().includes("mac");
    if (isMac) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "o") {
        e.preventDefault();
        handleMenuOpenFolder();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleMenuOpenFolder]);

  // 检查是否有上次的工作区（快速判断，决定渲染哪个页面）
  useEffect(() => {
    workspaceIpc
      .getCurrent()
      .then((saved) => {
        if (saved) {
          setWorkspacePath(saved);
        }
      })
      .catch(() => {})
      .finally(() => {
        setIsInitialized(true);
      });
  }, [setWorkspacePath]);

  // 阻止 Electron 默认的文件拖放导航行为
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
    };
    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
    };

    document.addEventListener("dragover", handleDragOver);
    document.addEventListener("drop", handleDrop);

    return () => {
      document.removeEventListener("dragover", handleDragOver);
      document.removeEventListener("drop", handleDrop);
    };
  }, []);

  // 初始化完成前不渲染（避免闪烁）
  if (!isInitialized) {
    return <div className="bg-background h-screen w-full" />;
  }

  // 没有工作区时显示欢迎页
  if (!workspacePath) {
    return (
      <>
        <WelcomePage />
        <Toaster position="bottom-right" />
      </>
    );
  }

  return (
    <>
      {/* 工作区：进入演示模式时淡出，退出时淡入 */}
      <motion.div
        animate={{ opacity: isPresentationMode ? 0 : 1 }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        onAnimationComplete={() => {
          // 动画完成时同步 showPresentation 状态
          // 进入演示模式（淡出完成）-> 显示演示视图
          // 退出演示模式（淡入完成）-> 隐藏演示视图
          setShowPresentation(isPresentationMode);
        }}
        style={{ pointerEvents: isPresentationMode ? "none" : "auto" }}
      >
        <NoteWorkspace />
      </motion.div>

      {/* 演示视图：延迟显示，退出时自动淡出 */}
      <AnimatePresence>{showPresentation && <PresentationView />}</AnimatePresence>

      <Toaster position="bottom-right" />
    </>
  );
}

export default App;
