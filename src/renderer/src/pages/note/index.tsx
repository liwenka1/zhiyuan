import { useEffect } from "react";
import { MainLayout } from "@/layouts/main-layout";
import { FolderTree } from "@/components/sidebar/folder-tree";
import { NoteList } from "@/components/sidebar/note-list";
import { EditorArea } from "@/components/editor/editor-area";
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

  // 初始化：检查是否有保存的工作区，或加载演示数据
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
          // 没有保存的工作区，加载演示数据
          initWithDemoData();
        }
      } catch (error) {
        console.error("初始化工作区失败:", error);
        // 出错时使用演示数据
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
    <MainLayout
      leftSidebar={
        <FolderTree
          folders={foldersWithCount}
          selectedFolderId={selectedFolderId}
          totalNoteCount={notes.length}
          onSelectFolder={selectFolder}
        />
      }
      rightSidebar={
        <NoteList notes={formattedNotes} selectedNoteId={selectedNoteId ?? undefined} onSelectNote={selectNote} />
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
  );
}
