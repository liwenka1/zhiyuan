import { useWorkspaceStore } from "@/stores/use-workspace-store";

export function WorkspaceSelector() {
  const workspacePath = useWorkspaceStore((state) => state.workspacePath);

  // 获取文件夹名称（路径的最后一部分）
  const getWorkspaceName = () => {
    if (!workspacePath) return "未选择工作区";
    // 使用字符串方法替代 path.basename
    const parts = workspacePath.replace(/\\/g, "/").split("/");
    return parts[parts.length - 1] || "工作区";
  };

  return <div className="text-foreground min-w-0 flex-1 truncate text-sm">{getWorkspaceName()}</div>;
}
