import { useState, useEffect, useCallback } from "react";
import { FolderOpen, FileText } from "lucide-react";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { DropHoverMask, TitleBar, SettingsPopover } from "@/components/app";
import { Logo } from "@/components/icons";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useWorkspaceStore, useNoteStore, useFolderStore } from "@/stores";
import { useMarkdownFileDrop, usePlatform } from "@/hooks";
import { workspaceIpc } from "@/ipc";

function getFileName(filePath: string): string {
  return filePath.split(/[/\\]/).pop() || "";
}

function getParentDir(filePath: string): string {
  const normalizedPath = filePath.replaceAll("\\", "/");
  const lastSlashIndex = normalizedPath.lastIndexOf("/");
  if (lastSlashIndex <= 0) {
    return normalizedPath;
  }
  return normalizedPath.slice(0, lastSlashIndex);
}

export function WelcomePage() {
  const { t } = useTranslation("common");
  const { t: tEditor } = useTranslation("editor");
  const { isMac, isWindows } = usePlatform();
  const setWorkspacePath = useWorkspaceStore((state) => state.setWorkspacePath);
  const loadFromFileSystem = useNoteStore((state) => state.loadFromFileSystem);
  const selectNote = useNoteStore((state) => state.selectNote);
  const setFolders = useFolderStore((state) => state.setFolders);
  const [recentWorkspaces, setRecentWorkspaces] = useState<string[]>([]);

  useEffect(() => {
    workspaceIpc
      .getRecent()
      .then(setRecentWorkspaces)
      .catch(() => {});
  }, []);

  const openResolvedFile = useCallback(
    async ({ filePath, workspacePath }: { filePath: string; workspacePath: string }) => {
      const data = await workspaceIpc.scan(workspacePath);
      if (!data) return;

      setWorkspacePath(workspacePath);
      setFolders(data.folders);
      loadFromFileSystem(data);

      const fileName = getFileName(filePath);
      const targetNote = data.notes.find((note) => note.fileName === fileName);
      if (targetNote) {
        setTimeout(() => selectNote(targetNote.id), 0);
      }
    },
    [loadFromFileSystem, selectNote, setFolders, setWorkspacePath]
  );

  const { isFileDropHover, dragHandlers } = useMarkdownFileDrop({
    onDropMarkdownFiles: async (sourcePaths) => {
      const filePath = sourcePaths[0];
      if (!filePath) return;

      await openResolvedFile({
        filePath,
        workspacePath: getParentDir(filePath)
      });
    }
  });

  const handleOpenFolder = async () => {
    try {
      const selectedPath = await workspaceIpc.select({
        title: t("workspace.selectFolder"),
        buttonLabel: t("workspace.selectButton")
      });

      // null = 用户取消或已跳转到已有窗口
      if (!selectedPath) return;

      const data = await workspaceIpc.scan(selectedPath);
      if (!data) return; // 已跳转到已有窗口

      setWorkspacePath(selectedPath);
      setFolders(data.folders);
      loadFromFileSystem(data);
    } catch {
      toast.error(t("welcome.openFolderFailed"));
    }
  };

  const handleOpenFile = async () => {
    try {
      const result = await workspaceIpc.openFile({
        title: t("welcome.openFile"),
        buttonLabel: t("workspace.selectButton")
      });

      // null = 用户取消或已跳转到已有窗口
      if (!result) return;

      await openResolvedFile(result);
    } catch {
      toast.error(t("welcome.openFileFailed"));
    }
  };

  const handleOpenRecent = async (workspacePath: string) => {
    try {
      const data = await workspaceIpc.scan(workspacePath);
      // null = 已跳转到已有窗口，当前窗口保持不变
      if (!data) return;

      setWorkspacePath(workspacePath);
      setFolders(data.folders);
      loadFromFileSystem(data);
    } catch {
      toast.error(t("welcome.openFolderFailed"));
    }
  };

  const getFolderName = (fullPath: string) => {
    return fullPath.split("/").pop() || fullPath;
  };

  return (
    <div
      className="relative flex h-screen w-full flex-col bg-background"
      onDragEnter={dragHandlers.onDragEnter}
      onDragOver={dragHandlers.onDragOver}
      onDragLeave={dragHandlers.onDragLeave}
      onDrop={dragHandlers.onDrop}
      style={{
        paddingTop: isMac
          ? "var(--titlebar-height-mac)"
          : isWindows
            ? "calc(var(--titlebar-height-windows) + 1px)"
            : "0px"
      }}
    >
      <TitleBar />
      <DropHoverMask visible={isFileDropHover} bottomGapPx={0} />

      {isWindows && <div className="border-t border-border" />}

      <div className="flex flex-1 items-center justify-center select-none">
        <div className="relative flex w-full max-w-sm flex-col items-center">
          {isFileDropHover && (
            <div className="pointer-events-none absolute inset-x-0 -top-6 z-10 rounded-lg border border-primary/30 bg-background/85 px-3 py-2 text-center text-sm text-primary backdrop-blur-sm">
              {t("welcome.openFile")}
            </div>
          )}
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <Logo className="h-16 w-16 text-foreground opacity-[0.12]" />
          </motion.div>

          {/* App 名称 */}
          <motion.h1
            className="mt-5 text-2xl font-light tracking-wide text-foreground"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.08 }}
          >
            {tEditor("appName")}
          </motion.h1>

          {/* 副标题 */}
          <motion.p
            className="mt-2 text-sm text-muted-foreground/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.14 }}
          >
            {t("welcome.subtitle")}
          </motion.p>

          {/* 操作按钮 */}
          <motion.div
            className="mt-8 flex w-full flex-col gap-2.5"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
          >
            <Button
              variant="outline"
              size="default"
              type="button"
              onClick={handleOpenFolder}
              className="h-auto w-full justify-center gap-2 rounded-lg px-5 py-2.5"
            >
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground/90">{t("welcome.openFolder")}</span>
            </Button>

            <Button
              variant="outline"
              size="default"
              type="button"
              onClick={handleOpenFile}
              className="h-auto w-full justify-center gap-2 rounded-lg px-5 py-2.5"
            >
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground/90">{t("welcome.openFile")}</span>
            </Button>
          </motion.div>

          {/* 最近打开列表 */}
          {recentWorkspaces.length > 0 && (
            <motion.div
              className="mt-6 w-full"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.3 }}
            >
              <ScrollArea viewportClassName="max-h-52">
                <div className="space-y-0.5">
                  {recentWorkspaces.map((workspace) => (
                    <Button
                      variant="ghost"
                      size="default"
                      type="button"
                      key={workspace}
                      onClick={() => handleOpenRecent(workspace)}
                      className="group h-auto w-full justify-start gap-3 rounded-lg px-3 py-2 text-left"
                    >
                      <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground/30 transition-colors group-hover:text-muted-foreground/60" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm text-foreground/70 transition-colors group-hover:text-foreground">
                          {getFolderName(workspace)}
                        </div>
                        <div className="truncate text-xs text-muted-foreground/40">{workspace}</div>
                      </div>
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </motion.div>
          )}
        </div>
      </div>

      {/* 底部设置 */}
      <motion.div
        className="flex shrink-0 items-center justify-center pb-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.4 }}
      >
        <SettingsPopover />
      </motion.div>
    </div>
  );
}
