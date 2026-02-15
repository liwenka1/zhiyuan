import { useNoteStore, useFolderStore, useGitHubSettingsStore } from "@/stores";
import { useNoteExport } from "@/features/export";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { shellIpc, fileIpc, githubIpc } from "@/ipc";
import { upsertGitHubMetadata } from "@/lib/github-metadata";

export interface NoteHandlers {
  handleCreateNote: () => Promise<void>;
  handleShowNoteInExplorer: (note: {
    id: string;
    title: string;
    updatedAt?: string;
    isPinned?: boolean;
  }) => Promise<void>;
  handleDeleteNote: (note: { id: string; title: string; updatedAt?: string; isPinned?: boolean }) => Promise<void>;
  handleRenameNote: (note: { id: string; title: string; updatedAt?: string; isPinned?: boolean }) => void;
  handleDuplicateNote: (note: { id: string; title: string; updatedAt?: string; isPinned?: boolean }) => Promise<void>;
  handleTogglePinNote: (note: { id: string; title: string; updatedAt?: string; isPinned?: boolean }) => Promise<void>;
  handleExportNote: (
    note: { id: string; title: string; updatedAt?: string; isPinned?: boolean },
    format: "html" | "pdf" | "pdf-pages" | "image" | "image-pages"
  ) => Promise<void>;
  handleCopyToWechat: (note: { id: string; title: string; updatedAt?: string; isPinned?: boolean }) => Promise<void>;
  handlePushToGitHub: (note: { id: string; title: string; updatedAt?: string; isPinned?: boolean }) => Promise<void>;
}

interface UseNoteHandlersProps {
  onOpenRenameDialog: (note: { id: string; title: string; updatedAt?: string; isPinned?: boolean }) => void;
}

/**
 * 笔记操作 Hook
 * 处理所有笔记相关的操作
 */
export function useNoteHandlers({ onOpenRenameDialog }: UseNoteHandlersProps): NoteHandlers {
  const { t } = useTranslation("note");
  const notes = useNoteStore((state) => state.notes);
  const updateNoteContentById = useNoteStore((state) => state.updateNoteContentById);
  const selectedFolderId = useFolderStore((state) => state.selectedFolderId);
  const createNote = useNoteStore((state) => state.createNote);
  const deleteNote = useNoteStore((state) => state.deleteNote);
  const duplicateNote = useNoteStore((state) => state.duplicateNote);
  const togglePinNote = useNoteStore((state) => state.togglePinNote);
  const githubStore = useGitHubSettingsStore;

  // 使用导出 hook
  const { exportNote, copyToWechat } = useNoteExport();

  // 处理新建笔记
  const handleCreateNote = async () => {
    await createNote(selectedFolderId || undefined);
  };

  // 在文件管理器中显示笔记
  const handleShowNoteInExplorer = async (note: {
    id: string;
    title: string;
    updatedAt?: string;
    isPinned?: boolean;
  }) => {
    // 从 store 中获取完整的笔记信息（包含 filePath）
    const fullNote = notes.find((n) => n.id === note.id);
    if (fullNote?.filePath) {
      try {
        await shellIpc.showItemInFolder(fullNote.filePath);
      } catch {
        toast.error(t("errors.showInExplorerFailed"));
      }
    }
  };

  // 删除笔记 - 直接删除
  const handleDeleteNote = async (note: { id: string; title: string; updatedAt?: string; isPinned?: boolean }) => {
    const fullNote = notes.find((n) => n.id === note.id);
    if (!fullNote?.filePath) return;

    try {
      await fileIpc.delete(fullNote.filePath);
      deleteNote(note.id);
    } catch {
      toast.error(t("errors.deleteNoteFailed"));
    }
  };

  // 重命名笔记 - 打开对话框
  const handleRenameNote = (note: { id: string; title: string; updatedAt?: string; isPinned?: boolean }) => {
    onOpenRenameDialog(note);
  };

  // 复制笔记
  const handleDuplicateNote = async (note: { id: string; title: string; updatedAt?: string; isPinned?: boolean }) => {
    await duplicateNote(note.id).catch(() => {});
  };

  // 切换置顶状态
  const handleTogglePinNote = async (note: { id: string; title: string; updatedAt?: string; isPinned?: boolean }) => {
    await togglePinNote(note.id).catch(() => {});
  };

  // 导出笔记
  const handleExportNote = async (
    note: { id: string; title: string; updatedAt?: string; isPinned?: boolean },
    format: "html" | "pdf" | "pdf-pages" | "image" | "image-pages"
  ) => {
    // 从 store 中获取完整的笔记信息
    const fullNote = notes.find((n) => n.id === note.id);
    if (!fullNote) return;

    await exportNote(fullNote, format);
  };

  // 复制笔记到微信公众号
  const handleCopyToWechat = async (note: { id: string; title: string; updatedAt?: string; isPinned?: boolean }) => {
    // 从 store 中获取完整的笔记信息
    const fullNote = notes.find((n) => n.id === note.id);
    if (!fullNote) return;

    await copyToWechat(fullNote);
  };

  const handlePushToGitHub = async (note: { id: string; title: string; updatedAt?: string; isPinned?: boolean }) => {
    const fullNote = notes.find((n) => n.id === note.id);
    if (!fullNote?.filePath || !fullNote.fileName) return;

    if (!githubStore.getState().isLoaded) {
      await githubStore.getState().load();
    }

    const { owner, repo, token } = githubStore.getState();
    const currentConfig = { owner, repo, token };
    if (!currentConfig.owner || !currentConfig.repo || !currentConfig.token) {
      toast.error(t("errors.githubConfigMissing"));
      return;
    }

    try {
      const title = fullNote.fileName.replace(/\.md$/i, "");
      const result = await githubIpc.pushIssue({
        owner: currentConfig.owner,
        repo: currentConfig.repo,
        token: currentConfig.token,
        title,
        body: fullNote.content,
        issueNumber: fullNote.github?.issueNumber
      });

      const nextContent = upsertGitHubMetadata(fullNote.content, {
        issueNumber: result.issueNumber,
        issueUrl: result.issueUrl
      });

      if (nextContent !== fullNote.content) {
        updateNoteContentById(fullNote.id, nextContent);
      }

      toast.success(t("github.pushSuccess", { url: result.issueUrl }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(t("errors.githubPushFailed", { message }));
    }
  };

  return {
    handleCreateNote,
    handleShowNoteInExplorer,
    handleDeleteNote,
    handleRenameNote,
    handleDuplicateNote,
    handleTogglePinNote,
    handleExportNote,
    handleCopyToWechat,
    handlePushToGitHub
  };
}
