import { FolderSync } from "lucide-react";
import { IconButton } from "@/components/ui/button";
import { useWorkspaceStore, useNoteStore, useFolderStore } from "@/stores";
import { useTranslation } from "react-i18next";
import { workspaceIpc } from "@/ipc";
import { toast } from "sonner";

export function WorkspaceToggle() {
  const setWorkspacePath = useWorkspaceStore((state) => state.setWorkspacePath);
  const loadFromFileSystem = useNoteStore((state) => state.loadFromFileSystem);
  const setFolders = useFolderStore((state) => state.setFolders);
  const { t } = useTranslation("common");

  // 处理切换工作区
  const handleSwitchWorkspace = async () => {
    try {
      // 打开文件夹选择对话框
      const selectedPath = await workspaceIpc.select({
        title: t("workspace.selectFolder"),
        buttonLabel: t("workspace.selectButton")
      });

      if (selectedPath) {
        // 更新工作区路径
        setWorkspacePath(selectedPath);

        // 扫描并加载工作区内容
        const data = await workspaceIpc.scan(selectedPath);
        setFolders(data.folders);
        loadFromFileSystem(data);
      }
    } catch {
      toast.error(t("workspace.selectFailed"));
    }
  };

  return (
    <IconButton onClick={handleSwitchWorkspace} aria-label={t("workspace.switch")}>
      <FolderSync className="size-4" />
    </IconButton>
  );
}
