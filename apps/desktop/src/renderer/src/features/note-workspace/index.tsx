import { MainLayout } from "@/layouts/main-layout";
import { FolderTree, NoteList } from "@/components/sidebar";
import { EditorArea } from "@/features/editor/editor-area";
import { NoteDialogs } from "./note-dialogs";
import { useNoteStore } from "@/stores";
import { useWorkspaceInit, useNoteHandlers, useFolderHandlers, useNoteData, useDialogState } from "./hooks";

/**
 * 笔记工作区
 * 负责：
 * - 组合各个子组件
 * - 协调业务逻辑
 */
export function NoteWorkspace() {
  // 初始化工作区和文件监听
  useWorkspaceInit();

  // Dialog 状态管理
  const dialogState = useDialogState();

  // Store 状态
  const selectedFolderId = useNoteStore((state) => state.selectedFolderId);
  const selectedNoteId = useNoteStore((state) => state.selectedNoteId);
  const editorContent = useNoteStore((state) => state.editorContent);
  const searchKeyword = useNoteStore((state) => state.searchKeyword);
  const notes = useNoteStore((state) => state.notes);
  const selectFolder = useNoteStore((state) => state.selectFolder);
  const selectNote = useNoteStore((state) => state.selectNote);
  const updateNoteContent = useNoteStore((state) => state.updateNoteContent);
  const setSearchKeyword = useNoteStore((state) => state.setSearchKeyword);

  // 笔记操作 handlers
  const noteHandlers = useNoteHandlers({
    onOpenRenameDialog: dialogState.openRenameNoteDialog
  });

  // 文件夹操作 handlers
  const folderHandlers = useFolderHandlers({
    onOpenCreateDialog: dialogState.openCreateFolderDialog,
    onOpenRenameDialog: dialogState.openRenameFolderDialog
  });

  // 数据派生
  const { formattedNotes, foldersWithCount } = useNoteData();

  return (
    <>
      <MainLayout
        leftSidebar={
          <FolderTree
            folders={foldersWithCount}
            selectedFolderId={selectedFolderId}
            totalNoteCount={notes.length}
            onSelectFolder={selectFolder}
            onCreateFolder={folderHandlers.handleCreateFolder}
            onShowFolderInExplorer={folderHandlers.handleShowFolderInExplorer}
            onDeleteFolder={folderHandlers.handleDeleteFolder}
            onRenameFolder={folderHandlers.handleRenameFolder}
          />
        }
        rightSidebar={
          <NoteList
            notes={formattedNotes}
            selectedNoteId={selectedNoteId ?? undefined}
            searchKeyword={searchKeyword}
            onSelectNote={selectNote}
            onCreateNote={noteHandlers.handleCreateNote}
            onSearchChange={setSearchKeyword}
            onShowNoteInExplorer={noteHandlers.handleShowNoteInExplorer}
            onDeleteNote={noteHandlers.handleDeleteNote}
            onRenameNote={noteHandlers.handleRenameNote}
            onDuplicateNote={noteHandlers.handleDuplicateNote}
            onExportNote={noteHandlers.handleExportNote}
            onCopyToWechat={noteHandlers.handleCopyToWechat}
          />
        }
        mainContent={
          <EditorArea
            content={editorContent}
            onChange={updateNoteContent}
            hasNote={!!selectedNoteId}
            noteId={selectedNoteId ?? undefined}
            notePath={notes.find((n) => n.id === selectedNoteId)?.filePath}
          />
        }
      />

      <NoteDialogs
        showCreateFolderDialog={dialogState.showCreateFolderDialog}
        onCloseCreateFolderDialog={dialogState.closeCreateFolderDialog}
        showRenameNoteDialog={dialogState.showRenameNoteDialog}
        noteToRename={dialogState.noteToRename}
        onCloseRenameNoteDialog={dialogState.closeRenameNoteDialog}
        showRenameFolderDialog={dialogState.showRenameFolderDialog}
        folderToRename={dialogState.folderToRename}
        onCloseRenameFolderDialog={dialogState.closeRenameFolderDialog}
      />
    </>
  );
}
