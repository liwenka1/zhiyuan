import { useEffect } from "react";
import { MainLayout } from "@/layouts/main-layout";
import { FolderTree } from "@/components/sidebar/folder-tree";
import { NoteList } from "@/components/sidebar/note-list";
import { EditorArea } from "@/components/editor/editor-area";
import { InputDialog } from "@renderer/components/input-dialog";
import { useNoteStore } from "@/stores/use-note-store";
import { useWorkspaceStore } from "@/stores/use-workspace-store";
import { useThemeStore } from "@/stores/use-theme-store";
import { useState } from "react";
import { useTranslation } from "react-i18next";

/**
 * 笔记页面
 * 负责：
 * - 从文件系统加载工作区数据
 * - 管理笔记模式：三栏布局（文件夹树 + 笔记列表 + 编辑区）
 */
export function NotePage() {
  const { t } = useTranslation("note");
  const loadFromFileSystem = useNoteStore((state) => state.loadFromFileSystem);
  const setWorkspacePath = useWorkspaceStore((state) => state.setWorkspacePath);
  const theme = useThemeStore((state) => state.theme);

  // 对话框状态
  const [showCreateFolderDialog, setShowCreateFolderDialog] = useState(false);
  const [showRenameNoteDialog, setShowRenameNoteDialog] = useState(false);
  const [showRenameFolderDialog, setShowRenameFolderDialog] = useState(false);
  const [noteToRename, setNoteToRename] = useState<{
    id: string;
    title: string;
    updatedAt?: string;
    isPinned?: boolean;
  } | null>(null);
  const [folderToRename, setFolderToRename] = useState<{
    id: string;
    name: string;
    noteCount?: number;
  } | null>(null);

  // 状态和方法
  const folders = useNoteStore((state) => state.folders);
  const notes = useNoteStore((state) => state.notes);
  const selectedFolderId = useNoteStore((state) => state.selectedFolderId);
  const selectedNoteId = useNoteStore((state) => state.selectedNoteId);
  const editorContent = useNoteStore((state) => state.editorContent);
  const searchKeyword = useNoteStore((state) => state.searchKeyword);

  const selectFolder = useNoteStore((state) => state.selectFolder);
  const selectNote = useNoteStore((state) => state.selectNote);
  const updateNoteContent = useNoteStore((state) => state.updateNoteContent);
  const createFolder = useNoteStore((state) => state.createFolder);
  const createNote = useNoteStore((state) => state.createNote);
  const deleteFolder = useNoteStore((state) => state.deleteFolder);
  const deleteNote = useNoteStore((state) => state.deleteNote);
  const renameNote = useNoteStore((state) => state.renameNote);
  const renameFolder = useNoteStore((state) => state.renameFolder);
  const duplicateNote = useNoteStore((state) => state.duplicateNote);
  const setSearchKeyword = useNoteStore((state) => state.setSearchKeyword);
  const exportNoteAsHTML = useNoteStore((state) => state.exportNoteAsHTML);
  const exportNoteAsPDF = useNoteStore((state) => state.exportNoteAsPDF);
  const copyNoteToWechat = useNoteStore((state) => state.copyNoteToWechat);
  const workspacePath = useWorkspaceStore((state) => state.workspacePath);

  // 处理新建文件夹 - 打开对话框
  const handleCreateFolder = () => {
    setShowCreateFolderDialog(true);
  };

  // 确认创建文件夹
  const handleConfirmCreateFolder = async (folderName: string) => {
    await createFolder(folderName);
  };

  // 处理新建笔记
  const handleCreateNote = async () => {
    await createNote(selectedFolderId || undefined);
  };

  // 在文件管理器中显示文件夹
  const handleShowFolderInExplorer = async (folder: { id: string; name: string; noteCount?: number }) => {
    if (!workspacePath) return;
    const folderPath = `${workspacePath}/${folder.name}`;
    await window.api.shell.openPath(folderPath);
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
      await window.api.shell.showItemInFolder(fullNote.filePath);
    }
  };

  // 删除文件夹 - 直接删除
  const handleDeleteFolder = async (folder: { id: string; name: string; noteCount?: number }) => {
    if (!workspacePath) return;
    const folderPath = `${workspacePath}/${folder.name}`;

    try {
      await window.api.folder.delete(folderPath);
      deleteFolder(folder.id);
    } catch (error) {
      console.error("删除文件夹失败:", error);
      alert("删除文件夹失败，请重试");
    }
  };

  // 删除笔记 - 直接删除
  const handleDeleteNote = async (note: { id: string; title: string; updatedAt?: string; isPinned?: boolean }) => {
    const fullNote = notes.find((n) => n.id === note.id);
    if (!fullNote?.filePath) return;

    try {
      await window.api.file.delete(fullNote.filePath);
      deleteNote(note.id);
    } catch (error) {
      console.error("删除笔记失败:", error);
      alert("删除笔记失败，请重试");
    }
  };

  // 重命名笔记 - 打开对话框
  const handleRenameNote = (note: { id: string; title: string; updatedAt?: string; isPinned?: boolean }) => {
    setNoteToRename(note);
    setShowRenameNoteDialog(true);
  };

  // 重命名文件夹 - 打开对话框
  const handleRenameFolder = (folder: { id: string; name: string; noteCount?: number }) => {
    setFolderToRename(folder);
    setShowRenameFolderDialog(true);
  };

  // 确认重命名笔记
  const handleConfirmRenameNote = async (newTitle: string) => {
    if (!noteToRename || !newTitle || newTitle === noteToRename.title) return;

    try {
      await renameNote(noteToRename.id, newTitle);
      setNoteToRename(null);
    } catch (error) {
      console.error("重命名笔记失败:", error);
      alert("重命名笔记失败，请重试");
    }
  };

  // 确认重命名文件夹
  const handleConfirmRenameFolder = async (newName: string) => {
    if (!folderToRename || !newName || newName === folderToRename.name) return;

    try {
      await renameFolder(folderToRename.id, newName);
      setFolderToRename(null);
    } catch (error) {
      console.error("重命名文件夹失败:", error);
      alert("重命名文件夹失败，请重试");
    }
  };

  // 复制笔记
  const handleDuplicateNote = async (note: { id: string; title: string; updatedAt?: string; isPinned?: boolean }) => {
    try {
      await duplicateNote(note.id);
    } catch (error) {
      console.error("复制笔记失败:", error);
      alert("复制笔记失败，请重试");
    }
  };

  // 导出笔记
  const handleExportNote = async (
    note: { id: string; title: string; updatedAt?: string; isPinned?: boolean },
    format: "html" | "pdf"
  ) => {
    try {
      const isDark = theme === "dark";
      if (format === "html") {
        await exportNoteAsHTML(note.id, isDark);
        console.log(t("export.success"));
      } else if (format === "pdf") {
        await exportNoteAsPDF(note.id, isDark);
        console.log(t("export.success"));
      }
    } catch (error) {
      console.error("导出笔记失败:", error);
      alert(t("export.failed"));
    }
  };

  // 复制笔记到微信公众号
  const handleCopyToWechat = async (note: { id: string; title: string; updatedAt?: string; isPinned?: boolean }) => {
    try {
      await copyNoteToWechat(note.id);
      alert(t("export.wechatSuccess"));
    } catch (error) {
      console.error("复制到微信公众号失败:", error);
      alert(t("export.wechatFailed"));
    }
  };

  // 初始化：检查是否有保存的工作区，或创建默认工作区
  useEffect(() => {
    const initWorkspace = async () => {
      try {
        // 尝试获取上次打开的工作区
        const savedWorkspacePath = await window.api.workspace.getCurrent();

        if (savedWorkspacePath) {
          // 有保存的工作区，加载它
          setWorkspacePath(savedWorkspacePath);
          const data = await window.api.workspace.scan(savedWorkspacePath);
          loadFromFileSystem(data);
        } else {
          // 没有保存的工作区，创建默认工作区
          const defaultWorkspacePath = await window.api.workspace.createDefault();
          setWorkspacePath(defaultWorkspacePath);
          const data = await window.api.workspace.scan(defaultWorkspacePath);
          loadFromFileSystem(data);
        }
      } catch (error) {
        console.error("初始化工作区失败:", error);
        // 初始化失败，显示错误提示
        alert("初始化工作区失败，请检查文件系统权限或重启应用");
      }
    };

    initWorkspace();
  }, [loadFromFileSystem, setWorkspacePath]);

  // 监听文件系统变化
  useEffect(() => {
    // 获取处理方法
    const handleFileAdded = useNoteStore.getState().handleFileAdded;
    const handleFileDeleted = useNoteStore.getState().handleFileDeleted;
    const handleFileChanged = useNoteStore.getState().handleFileChanged;
    const handleFolderAdded = useNoteStore.getState().handleFolderAdded;
    const handleFolderDeleted = useNoteStore.getState().handleFolderDeleted;

    // 注册文件监听器
    const unsubscribeAdded = window.api.file.onAdded((data) => {
      handleFileAdded(data.filePath, data.fullPath);
    });

    const unsubscribeDeleted = window.api.file.onDeleted((data) => {
      handleFileDeleted(data.filePath);
    });

    const unsubscribeChanged = window.api.file.onChanged((data) => {
      handleFileChanged(data.filePath, data.fullPath);
    });

    // 注册文件夹监听器
    const unsubscribeFolderAdded = window.api.folder.onAdded((data) => {
      handleFolderAdded(data.folderPath, data.fullPath);
    });

    const unsubscribeFolderDeleted = window.api.folder.onDeleted((data) => {
      handleFolderDeleted(data.folderPath);
    });

    // 清理监听器
    return () => {
      unsubscribeAdded();
      unsubscribeDeleted();
      unsubscribeChanged();
      unsubscribeFolderAdded();
      unsubscribeFolderDeleted();
    };
  }, []);

  // 笔记模式：三栏布局
  // 根据选中的文件夹过滤笔记，如果没有选中文件夹则显示所有笔记
  let filteredNotes = selectedFolderId ? notes.filter((note) => note.folderId === selectedFolderId) : notes;

  // 根据搜索关键词过滤笔记（搜索标题和内容）
  if (searchKeyword.trim()) {
    const keyword = searchKeyword.toLowerCase();
    filteredNotes = filteredNotes.filter(
      (note) => note.title.toLowerCase().includes(keyword) || note.content.toLowerCase().includes(keyword)
    );
  }

  // 格式化笔记列表数据（置顶笔记排在前面）
  const formattedNotes = filteredNotes
    .sort((a, b) => {
      // 置顶笔记优先
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return 0;
    })
    .map((note) => ({
      id: note.id,
      title: note.title,
      updatedAt: note.updatedAt,
      isPinned: note.isPinned
    }));

  // 计算每个文件夹的真实笔记数量
  const foldersWithCount = folders.map((folder) => ({
    ...folder,
    noteCount: notes.filter((note) => note.folderId === folder.id).length
  }));

  return (
    <>
      <MainLayout
        leftSidebar={
          <FolderTree
            folders={foldersWithCount}
            selectedFolderId={selectedFolderId}
            totalNoteCount={notes.length}
            onSelectFolder={selectFolder}
            onCreateFolder={handleCreateFolder}
            onShowFolderInExplorer={handleShowFolderInExplorer}
            onDeleteFolder={handleDeleteFolder}
            onRenameFolder={handleRenameFolder}
          />
        }
        rightSidebar={
          <NoteList
            notes={formattedNotes}
            selectedNoteId={selectedNoteId ?? undefined}
            searchKeyword={searchKeyword}
            onSelectNote={selectNote}
            onCreateNote={handleCreateNote}
            onSearchChange={setSearchKeyword}
            onShowNoteInExplorer={handleShowNoteInExplorer}
            onDeleteNote={handleDeleteNote}
            onRenameNote={handleRenameNote}
            onDuplicateNote={handleDuplicateNote}
            onExportNote={handleExportNote}
            onCopyToWechat={handleCopyToWechat}
          />
        }
        mainContent={
          <EditorArea
            content={editorContent}
            onChange={updateNoteContent}
            hasNote={!!selectedNoteId}
            noteId={selectedNoteId ?? undefined}
          />
        }
      />

      {/* 新建文件夹对话框 */}
      <InputDialog
        open={showCreateFolderDialog}
        onOpenChange={setShowCreateFolderDialog}
        title="新建文件夹"
        description="请输入文件夹名称"
        placeholder="例如：工作、学习、生活..."
        onConfirm={handleConfirmCreateFolder}
      />

      {/* 重命名文件夹对话框 */}
      <InputDialog
        open={showRenameFolderDialog}
        onOpenChange={setShowRenameFolderDialog}
        title="重命名文件夹"
        description="请输入新的文件夹名称"
        placeholder="文件夹名称"
        defaultValue={folderToRename?.name}
        onConfirm={handleConfirmRenameFolder}
      />

      {/* 重命名笔记对话框 */}
      <InputDialog
        open={showRenameNoteDialog}
        onOpenChange={setShowRenameNoteDialog}
        title="重命名笔记"
        description="请输入新的笔记名称"
        placeholder="笔记名称"
        defaultValue={noteToRename?.title}
        onConfirm={handleConfirmRenameNote}
      />
    </>
  );
}
