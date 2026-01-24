import { FolderSync } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspaceStore } from "@/stores";
import { useNoteStore } from "@/stores";
import { useTranslation } from "react-i18next";

export function WorkspaceToggle() {
  const setWorkspacePath = useWorkspaceStore((state) => state.setWorkspacePath);
  const loadFromFileSystem = useNoteStore((state) => state.loadFromFileSystem);
  const { t } = useTranslation("common");

  // 处理切换工作区
  const handleSwitchWorkspace = async () => {
    try {
      // 打开文件夹选择对话框
      const selectedPath = await window.api.workspace.select({
        title: t("workspace.selectFolder"),
        buttonLabel: t("workspace.selectButton")
      });

      if (selectedPath) {
        // 更新工作区路径
        setWorkspacePath(selectedPath);

        // 扫描并加载工作区内容
        const data = await window.api.workspace.scan(selectedPath);
        loadFromFileSystem(data);
      }
    } catch (error) {
      console.error("选择工作区失败:", error);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-8 w-8 p-0"
      onClick={handleSwitchWorkspace}
      aria-label={t("workspace.switch")}
    >
      <FolderSync className="h-4 w-4" />
    </Button>
  );
}
