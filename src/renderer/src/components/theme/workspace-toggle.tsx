import { FolderSync } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useWorkspaceStore } from "@/stores/use-workspace-store";
import { useNoteStore } from "@/stores/use-note-store";
import { useTranslation } from "react-i18next";

export function WorkspaceToggle() {
  const setWorkspacePath = useWorkspaceStore((state) => state.setWorkspacePath);
  const loadFromFileSystem = useNoteStore((state) => state.loadFromFileSystem);
  const { t } = useTranslation("common");

  // 处理切换工作区
  const handleSwitchWorkspace = async () => {
    try {
      // 打开文件夹选择对话框
      const selectedPath = await window.api.workspace.select();

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
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={handleSwitchWorkspace}
            aria-label={t("workspace.switch")}
          >
            <FolderSync className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p>{t("workspace.switch")}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
