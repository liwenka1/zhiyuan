import { MainLayout } from "@/layouts/main-layout";
import { FolderTree } from "./folder-tree";
import { NoteList } from "./note-list";
import { NoteDialogs } from "./note-dialogs";
import { EditorArea } from "@/features/editor";
import { useNoteStore, useFolderStore } from "@/stores";
import { useWorkspaceInit, useNoteHandlers, useFolderHandlers, useNoteData, useDialogState } from "../hooks";

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
  const selectedFolderId = useFolderStore((state) => state.selectedFolderId);
  const selectedNoteId = useNoteStore((state) => state.selectedNoteId);
  const editorContent = useNoteStore((state) => state.editorContent);
  const openNoteIds = useNoteStore((state) => state.openNoteIds);
  const searchKeyword = useNoteStore((state) => state.searchKeyword);
  const notes = useNoteStore((state) => state.notes);
  const selectFolder = useFolderStore((state) => state.selectFolder);
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
    onOpenRssImportDialog: dialogState.openRssImportDialog,
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
            onImportRss={folderHandlers.handleImportRss}
            onUpdateRss={folderHandlers.handleUpdateRss}
            onUnsubscribeRss={folderHandlers.handleUnsubscribeRss}
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
            onCreateFromUrl={dialogState.openUrlCreateDialog}
            onSearchChange={setSearchKeyword}
            onShowNoteInExplorer={noteHandlers.handleShowNoteInExplorer}
            onDeleteNote={noteHandlers.handleDeleteNote}
            onRenameNote={noteHandlers.handleRenameNote}
            onDuplicateNote={noteHandlers.handleDuplicateNote}
            onTogglePinNote={noteHandlers.handleTogglePinNote}
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
            openNoteIds={openNoteIds}
            notes={notes}
            onShowNoteInExplorer={noteHandlers.handleShowNoteInExplorer}
            onRenameNote={noteHandlers.handleRenameNote}
            onDuplicateNote={noteHandlers.handleDuplicateNote}
            onExportNote={noteHandlers.handleExportNote}
            onDeleteNote={noteHandlers.handleDeleteNote}
          />
        }
      />

      <NoteDialogs
        showCreateFolderDialog={dialogState.showCreateFolderDialog}
        onCloseCreateFolderDialog={dialogState.closeCreateFolderDialog}
        showRssImportDialog={dialogState.showRssImportDialog}
        onCloseRssImportDialog={dialogState.closeRssImportDialog}
        showUrlCreateDialog={dialogState.showUrlCreateDialog}
        onCloseUrlCreateDialog={dialogState.closeUrlCreateDialog}
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
