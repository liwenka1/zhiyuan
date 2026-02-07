import { useState, useEffect } from "react";
import { FolderOpen, FileText } from "lucide-react";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { TitleBar } from "@/components/app";
import { ThemeToggle, LanguageToggle } from "@/components/app";
import { Logo } from "@/components/icons";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useWorkspaceStore, useNoteStore, useFolderStore } from "@/stores";
import { usePlatform } from "@/hooks";
import { workspaceIpc } from "@/ipc";

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

      const data = await workspaceIpc.scan(result.workspacePath);
      if (!data) return; // 已跳转到已有窗口

      setWorkspacePath(result.workspacePath);
      setFolders(data.folders);
      loadFromFileSystem(data);

      const fileName = result.filePath.split("/").pop() || "";
      const targetNote = data.notes.find((n) => n.fileName === fileName);
      if (targetNote) {
        setTimeout(() => selectNote(targetNote.id), 0);
      }
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
      className="bg-background flex h-screen w-full flex-col"
      style={{
        paddingTop: isMac
          ? "var(--titlebar-height-mac)"
          : isWindows
            ? "calc(var(--titlebar-height-windows) + 1px)"
            : "0px"
      }}
    >
      <TitleBar />

      {isMac && (
        <div
          className="pointer-events-none fixed inset-x-0 top-0 z-50"
          style={
            {
              height: "var(--titlebar-height-mac)",
              WebkitAppRegion: "drag"
            } as React.CSSProperties
          }
        />
      )}

      <div className="flex flex-1 items-center justify-center select-none">
        <div className="flex w-full max-w-sm flex-col items-center">
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <Logo className="text-foreground h-16 w-16 opacity-[0.12]" />
          </motion.div>

          {/* App 名称 */}
          <motion.h1
            className="text-foreground mt-5 text-2xl font-light tracking-wide"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.08 }}
          >
            {tEditor("appName")}
          </motion.h1>

          {/* 副标题 */}
          <motion.p
            className="text-muted-foreground/60 mt-2 text-sm"
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
            <button
              onClick={handleOpenFolder}
              className="bg-foreground/6 hover:bg-foreground/10 border-border/60 hover:border-border flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border px-5 py-2.5 transition-colors"
            >
              <FolderOpen className="text-muted-foreground h-4 w-4" />
              <span className="text-foreground/90 text-sm font-medium">{t("welcome.openFolder")}</span>
            </button>

            <button
              onClick={handleOpenFile}
              className="bg-foreground/6 hover:bg-foreground/10 border-border/60 hover:border-border flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border px-5 py-2.5 transition-colors"
            >
              <FileText className="text-muted-foreground h-4 w-4" />
              <span className="text-foreground/90 text-sm font-medium">{t("welcome.openFile")}</span>
            </button>
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
                    <button
                      key={workspace}
                      onClick={() => handleOpenRecent(workspace)}
                      className="hover:bg-muted/40 group flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors"
                    >
                      <FolderOpen className="text-muted-foreground/30 group-hover:text-muted-foreground/60 h-4 w-4 shrink-0 transition-colors" />
                      <div className="min-w-0 flex-1">
                        <div className="text-foreground/70 group-hover:text-foreground truncate text-sm transition-colors">
                          {getFolderName(workspace)}
                        </div>
                        <div className="text-muted-foreground/40 truncate text-xs">{workspace}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </motion.div>
          )}
        </div>
      </div>

      {/* 底部设置 */}
      <motion.div
        className="flex shrink-0 items-center justify-center gap-2 pb-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.4 }}
      >
        <ThemeToggle />
        <LanguageToggle />
      </motion.div>
    </div>
  );
}
