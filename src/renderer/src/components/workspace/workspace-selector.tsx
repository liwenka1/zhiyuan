import { FolderOpen, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspaceStore } from "@/stores/use-workspace-store";
import { useNoteStore } from "@/stores/use-note-store";

export function WorkspaceSelector() {
  const workspacePath = useWorkspaceStore((state) => state.workspacePath);
  const setWorkspacePath = useWorkspaceStore((state) => state.setWorkspacePath);
  const loadFromFileSystem = useNoteStore((state) => state.loadFromFileSystem);

  const handleSelectWorkspace = async () => {
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

  // 获取文件夹名称（路径的最后一部分）
  const getWorkspaceName = () => {
    if (!workspacePath) return "选择工作区";
    // 使用字符串方法替代 path.basename
    const parts = workspacePath.replace(/\\/g, "/").split("/");
    return parts[parts.length - 1] || "工作区";
  };

  return (
    <Button
      variant="ghost"
      className="text-muted-foreground hover:text-foreground h-8 w-full justify-between text-xs font-medium"
      onClick={handleSelectWorkspace}
    >
      <div className="flex min-w-0 items-center gap-2">
        <FolderOpen className="h-4 w-4 shrink-0" />
        <span className="truncate">{getWorkspaceName()}</span>
      </div>
      <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
    </Button>
  );
}
