import { useEffect, useState } from "react";
import { MainLayout } from "@/layouts/main-layout";
import { FolderTree } from "@/components/sidebar/folder-tree";
import { NoteList } from "@/components/sidebar/note-list";
import { EditorArea } from "@/components/editor/editor-area";
import { InputDialog } from "@/components/ui/input-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { useNoteStore } from "@/stores/use-note-store";
import { useWorkspaceStore } from "@/stores/use-workspace-store";
import { useViewStore } from "@/stores/use-view-store";
import { PresentationMode } from "./modes/presentation-mode";

/**
 * 笔记页面
 * 负责：
 * - 初始化演示数据或从文件系统加载
 * - 管理页面级模式切换（note / presentation）
 * - 笔记模式：三栏布局（文件夹树 + 笔记列表 + 编辑区）
 * - 演示模式：全屏幻灯片
 */
export function NotePage() {
  const viewMode = useViewStore((state) => state.viewMode);
  const initWithDemoData = useNoteStore((state) => state.initWithDemoData);
  const loadFromFileSystem = useNoteStore((state) => state.loadFromFileSystem);
  const setWorkspacePath = useWorkspaceStore((state) => state.setWorkspacePath);

  // 对话框状态
  const [showCreateFolderDialog, setShowCreateFolderDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "folder" | "note";
    id: string;
    name: string;
    path?: string;
  } | null>(null);

  // 状态和方法
  const folders = useNoteStore((state) => state.folders);
  const notes = useNoteStore((state) => state.notes);
  const selectedFolderId = useNoteStore((state) => state.selectedFolderId);
  const selectedNoteId = useNoteStore((state) => state.selectedNoteId);
  const editorContent = useNoteStore((state) => state.editorContent);

  const selectFolder = useNoteStore((state) => state.selectFolder);
  const selectNote = useNoteStore((state) => state.selectNote);
  const updateNoteContent = useNoteStore((state) => state.updateNoteContent);
  const getSelectedNote = useNoteStore((state) => state.getSelectedNote);
  const createFolder = useNoteStore((state) => state.createFolder);
  const createNote = useNoteStore((state) => state.createNote);
  const deleteFolder = useNoteStore((state) => state.deleteFolder);
  const deleteNote = useNoteStore((state) => state.deleteNote);
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

  // 删除文件夹 - 打开确认对话框
  const handleDeleteFolder = (folder: { id: string; name: string; noteCount?: number }) => {
    if (!workspacePath) return;
    const folderPath = `${workspacePath}/${folder.name}`;
    setDeleteTarget({
      type: "folder",
      id: folder.id,
      name: folder.name,
      path: folderPath
    });
    setShowDeleteDialog(true);
  };

  // 删除笔记 - 打开确认对话框
  const handleDeleteNote = (note: { id: string; title: string; updatedAt?: string; isPinned?: boolean }) => {
    const fullNote = notes.find((n) => n.id === note.id);
    if (!fullNote?.filePath) return;

    setDeleteTarget({
      type: "note",
      id: note.id,
      name: note.title,
      path: fullNote.filePath
    });
    setShowDeleteDialog(true);
  };

  // 确认删除
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      if (deleteTarget.type === "folder") {
        // 删除文件夹
        if (deleteTarget.path) {
          await window.api.folder.delete(deleteTarget.path);
          deleteFolder(deleteTarget.id);
          console.log("文件夹已删除:", deleteTarget.path);
        }
      } else {
        // 删除笔记
        if (deleteTarget.path) {
          await window.api.file.delete(deleteTarget.path);
          deleteNote(deleteTarget.id);
          console.log("笔记已删除:", deleteTarget.path);
        }
      }
      setShowDeleteDialog(false);
      setDeleteTarget(null);
    } catch (error) {
      console.error("删除失败:", error);
      alert(`删除${deleteTarget.type === "folder" ? "文件夹" : "笔记"}失败，请重试`);
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
          console.log("已加载工作区:", savedWorkspacePath);
        } else {
          // 没有保存的工作区，创建默认工作区
          console.log("首次启动，创建默认工作区...");
          const defaultWorkspacePath = await window.api.workspace.createDefault();
          setWorkspacePath(defaultWorkspacePath);
          const data = await window.api.workspace.scan(defaultWorkspacePath);
          loadFromFileSystem(data);
          console.log("已创建并加载默认工作区:", defaultWorkspacePath);
        }
      } catch (error) {
        console.error("初始化工作区失败:", error);
        // 出错时使用演示数据作为后备方案
        console.log("使用演示数据作为后备方案");
        initWithDemoData();
      }
    };

    initWorkspace();
  }, [initWithDemoData, loadFromFileSystem, setWorkspacePath]);

  // 幻灯片模式：全屏展示
  if (viewMode === "presentation") {
    return <PresentationMode />;
  }

  // 笔记模式：三栏布局
  // 根据选中的文件夹过滤笔记，如果没有选中文件夹则显示所有笔记
  const filteredNotes = selectedFolderId ? notes.filter((note) => note.folderId === selectedFolderId) : notes;

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

  // 获取当前选中笔记的标题
  const currentNote = getSelectedNote();
  const fileName = currentNote?.title;

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
          />
        }
        rightSidebar={
          <NoteList
            notes={formattedNotes}
            selectedNoteId={selectedNoteId ?? undefined}
            onSelectNote={selectNote}
            onCreateNote={handleCreateNote}
            onShowNoteInExplorer={handleShowNoteInExplorer}
            onDeleteNote={handleDeleteNote}
          />
        }
        mainContent={
          <EditorArea
            content={editorContent}
            onChange={updateNoteContent}
            hasNote={!!selectedNoteId}
            fileName={fileName}
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

      {/* 删除确认对话框 */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{deleteTarget?.type === "folder" ? "删除文件夹" : "删除笔记"}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.type === "folder" ? (
                <>
                  确定要删除文件夹 <strong>&ldquo;{deleteTarget.name}&rdquo;</strong> 吗？
                </>
              ) : (
                <>
                  确定要删除笔记 <strong>&ldquo;{deleteTarget?.name}&rdquo;</strong> 吗？
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
