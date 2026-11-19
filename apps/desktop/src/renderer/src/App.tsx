import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NoteWorkspace } from "@/features/note-workspace";
import { WelcomePage } from "@/features/welcome";
import {
  useThemeStore,
  useViewStore,
  useWorkspaceStore,
  useFolderStore,
  useNoteStore,
  useExportThemeStore,
  useExportLayoutStore,
  useShortcutsStore
} from "@/stores";
import { Toaster } from "@/components/ui/sonner";
import { IconButton } from "@/components/ui/button";
import { PresentationView } from "@/features/editor";
import { workspaceIpc } from "@/ipc";
import { useShortcutDispatcher } from "@/hooks/use-shortcut-dispatcher";
import { useWindowClose } from "@/hooks/use-window-close";
import { SaveConflictDialog } from "@/components/app/save-conflict-dialog";
import { SettingsPage, TitleBar } from "@/components/app";
import { WorkspaceSearch } from "@/components/app/workspace-search";
import { isEditingBlocked, useOperationStore } from "@/stores/note-store/operation-guard";
import type { ShortcutId } from "@shared";

const WELCOME_SHORTCUTS: ReadonlySet<ShortcutId> = new Set(["openSettings"]);
const SETTINGS_SHORTCUTS: ReadonlySet<ShortcutId> = new Set([
  "openSettings",
  "toggleNoteSearch",
  "toggleFolderSidebar"
]);

interface SettingsSession {
  returnFocusTo: HTMLElement | null;
}

function App(): React.JSX.Element {
  useWindowClose();
  const { t } = useTranslation("common");
  const initTheme = useThemeStore((state) => state.initTheme);
  const cleanup = useThemeStore((state) => state.cleanup);
  const isPresentationMode = useViewStore((state) => state.isPresentationMode);
  const workspacePath = useWorkspaceStore((state) => state.workspacePath);
  const isWorkspaceLoading = useWorkspaceStore((state) => state.isLoading);
  const isOperationPending = useOperationStore((state) => state.fileOperationCount > 0 || state.closeRequestCount > 0);
  const setWorkspacePath = useWorkspaceStore((state) => state.setWorkspacePath);
  const setPendingFilePath = useWorkspaceStore((state) => state.setPendingFilePath);
  const [showPresentation, setShowPresentation] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [settingsSession, setSettingsSession] = useState<SettingsSession | null>(null);
  const [searchFocusRequest, setSearchFocusRequest] = useState(0);
  const activeSettingsSession = useRef<SettingsSession | null>(null);
  const settingsOpen = settingsSession !== null;

  const dismissSettings = useCallback(() => {
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.closest("[data-settings-page]")) active.blur();
    const returnTarget = activeSettingsSession.current?.returnFocusTo;
    activeSettingsSession.current = null;
    setSettingsSession(null);
    return returnTarget;
  }, []);

  const closeSettings = useCallback(() => {
    const returnTarget = dismissSettings();
    requestAnimationFrame(() => {
      if (activeSettingsSession.current) return;
      if (returnTarget?.isConnected && returnTarget !== document.body && !returnTarget.closest("[inert]")) {
        returnTarget.focus({ preventScroll: true });
      } else {
        const settingsToggle = document.querySelector<HTMLElement>("[data-settings-toggle]:enabled");
        const fallback =
          settingsToggle && !settingsToggle.closest("[inert]")
            ? settingsToggle
            : document.querySelector<HTMLElement>('button[aria-controls="workspace-folders"]');
        fallback?.focus({ preventScroll: true });
      }
    });
  }, [dismissSettings]);

  const toggleSettings = () => {
    if (activeSettingsSession.current) {
      closeSettings();
      return;
    }
    const session: SettingsSession = {
      returnFocusTo: document.activeElement instanceof HTMLElement ? document.activeElement : null
    };
    activeSettingsSession.current = session;
    setSettingsSession(session);
  };

  const openNote = useCallback(
    (noteId: string) => {
      if (useWorkspaceStore.getState().isLoading || isEditingBlocked()) return false;
      const noteStore = useNoteStore.getState();
      if (noteStore.selectedNoteId !== noteId) noteStore.selectNote(noteId);
      if (useNoteStore.getState().selectedNoteId !== noteId) return false;
      // Imports retain the callback from when they started.
      if (settingsSession && activeSettingsSession.current === settingsSession) {
        dismissSettings();
      }
      return true;
    },
    [dismissSettings, settingsSession]
  );

  const openSearchNote = useCallback(
    (noteId: string) => {
      if (!openNote(noteId)) return;
      window.dispatchEvent(new Event("app:clear-note-selection"));
      const previousFocus = document.activeElement;
      requestAnimationFrame(() => {
        if (useNoteStore.getState().selectedNoteId !== noteId || document.activeElement !== previousFocus) return;
        const note = document.querySelector("[data-active-note]");
        const editor = note?.querySelector<HTMLElement>(".cm-content");
        const view = useViewStore.getState();
        const editorCollapsed =
          view.isSplitMode() && editor?.closest('[data-slot="resizable-panel"]')?.clientWidth === 0;
        const destination =
          view.isPreviewMode() || editorCollapsed ? note?.querySelector<HTMLElement>("[data-note-preview]") : editor;
        destination?.focus({ preventScroll: true });
      });
    },
    [openNote]
  );

  const openSearchFolder = useCallback((folderId: string) => {
    if (useWorkspaceStore.getState().isLoading || isEditingBlocked()) return;
    const folderStore = useFolderStore.getState();
    if (!folderStore.folders.some((folder) => folder.id === folderId)) return;
    folderStore.selectFolder(folderId);
    useViewStore.getState().revealFolderSidebar();
  }, []);

  // 打开文件夹（菜单触发）
  const handleMenuOpenFolder = useCallback(async () => {
    try {
      const selectedPath = await workspaceIpc.select();
      if (!selectedPath) return;

      dismissSettings();
      setWorkspacePath(selectedPath);
    } catch {
      /* 静默处理 */
    }
  }, [dismissSettings, setWorkspacePath]);

  // 打开文件（菜单触发）
  const handleMenuOpenFile = useCallback(async () => {
    try {
      const result = await workspaceIpc.openFile();
      if (!result) return;

      dismissSettings();
      setPendingFilePath(result.filePath);
      setWorkspacePath(result.workspacePath);
    } catch {
      /* 静默处理 */
    }
  }, [dismissSettings, setPendingFilePath, setWorkspacePath]);

  const handleExternalOpen = useCallback(
    async (payload: { workspacePath: string; filePath?: string }) => {
      try {
        dismissSettings();
        if (payload.filePath) setPendingFilePath(payload.filePath);
        setWorkspacePath(payload.workspacePath);
      } catch {
        /* 静默处理 */
      }
    },
    [dismissSettings, setPendingFilePath, setWorkspacePath]
  );

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

  const loadShortcuts = useShortcutsStore((state) => state.load);

  useEffect(() => {
    void loadShortcuts();
  }, [loadShortcuts]);

  // 监听菜单「打开文件夹/文件」事件（macOS 原生菜单 + Windows 自定义菜单栏）
  useEffect(() => {
    const unsubFolder = workspaceIpc.onMenuOpenFolder(handleMenuOpenFolder);
    const unsubFile = workspaceIpc.onMenuOpenFile(handleMenuOpenFile);
    const unsubExternal = workspaceIpc.onExternalOpen(handleExternalOpen);

    // Windows 自定义菜单栏通过 DOM 事件触发
    const onDomOpenFolder = () => handleMenuOpenFolder();
    const onDomOpenFile = () => handleMenuOpenFile();
    window.addEventListener("app:menu-open-folder", onDomOpenFolder);
    window.addEventListener("app:menu-open-file", onDomOpenFile);

    return () => {
      unsubFolder();
      unsubFile();
      unsubExternal();
      window.removeEventListener("app:menu-open-folder", onDomOpenFolder);
      window.removeEventListener("app:menu-open-file", onDomOpenFile);
    };
  }, [handleMenuOpenFolder, handleMenuOpenFile, handleExternalOpen]);

  // Windows/Linux: Ctrl+O 打开文件
  useEffect(() => {
    const isMac = navigator.userAgent.toLowerCase().includes("mac");
    if (isMac) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing || e.repeat) return;
      if (e.target instanceof HTMLElement && e.target.closest('[role="dialog"], [role="alertdialog"]')) return;
      if (e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey && e.key === "o") {
        e.preventDefault();
        handleMenuOpenFile();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleMenuOpenFile]);

  useShortcutDispatcher({
    context: {
      openSettings: toggleSettings,
      openCreateFolderDialog: () => window.dispatchEvent(new Event("app:open-create-folder")),
      openRssImportDialog: () => window.dispatchEvent(new Event("app:open-rss-import")),
      openUrlCreateDialog: () => window.dispatchEvent(new Event("app:open-url-create")),
      toggleNoteSearch: () => setSearchFocusRequest((current) => current + 1),
      formatNote: () => useNoteStore.getState().formatCurrentNote()
    },
    enabled: isInitialized && !isPresentationMode && !isOperationPending && !isWorkspaceLoading,
    allowedShortcuts: !workspacePath ? WELCOME_SHORTCUTS : settingsOpen ? SETTINGS_SHORTCUTS : undefined
  });

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

  const settings = settingsOpen && <SettingsPage onBack={closeSettings} />;
  const settingsButton = (
    <IconButton
      data-settings-toggle
      aria-label={t("settings.title")}
      aria-pressed={settingsOpen}
      title={t("settings.title")}
      disabled={isOperationPending}
      onMouseDown={(event) => {
        if (!settingsOpen) event.preventDefault();
      }}
      onClick={toggleSettings}
    >
      <Settings aria-hidden="true" />
    </IconButton>
  );

  return (
    <>
      <SaveConflictDialog />
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
        inert={isPresentationMode}
        className="bg-background flex h-screen min-h-0 w-full flex-col"
      >
        <TitleBar disabled={isOperationPending}>
          {workspacePath && (
            <WorkspaceSearch
              focusRequest={searchFocusRequest}
              disabled={isOperationPending || isPresentationMode}
              onSelectFolder={openSearchFolder}
              onSelectNote={openSearchNote}
            />
          )}
        </TitleBar>
        <div className="min-h-0 flex-1">
          {workspacePath ? (
            <NoteWorkspace mainOverlay={settings} onOpenNote={openNote} settingsButton={settingsButton} />
          ) : settings ? (
            <main className="h-full">{settings}</main>
          ) : (
            <WelcomePage settingsButton={settingsButton} />
          )}
        </div>
      </motion.div>

      {/* 演示视图：延迟显示，退出时自动淡出 */}
      <AnimatePresence>{showPresentation && <PresentationView />}</AnimatePresence>

      <Toaster position="bottom-right" />
    </>
  );
}

export default App;
