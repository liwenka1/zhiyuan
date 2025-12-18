import { useWorkspaceStore } from "@/stores/use-workspace-store";
import { useNoteStore } from "@/stores/use-note-store";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function WorkspaceSelector() {
  const workspacePath = useWorkspaceStore((state) => state.workspacePath);

  // 获取文件夹名称（路径的最后一部分）
  const getWorkspaceName = () => {
    if (!workspacePath) return "未选择工作区";
    // 使用字符串方法替代 path.basename
    const parts = workspacePath.replace(/\\/g, "/").split("/");
    return parts[parts.length - 1] || "工作区";
  };

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="min-w-0 flex-1 truncate text-sm font-semibold">{getWorkspaceName()}</div>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="start">
          <p className="max-w-xs truncate text-xs">{workspacePath || "未选择工作区"}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
