import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  type Modifier,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors
} from "@dnd-kit/core";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import { FileText } from "lucide-react";
import { useState } from "react";
import { MainLayout } from "@/layouts/main-layout";
import { ListRow } from "@/components/app/list-row";
import { FolderTree } from "./folder-tree";
import { NoteList } from "./note-list";
import { NoteDialogs } from "./note-dialogs";
import { EditorArea } from "@/features/editor";
import { useNoteStore, useFolderStore } from "@/stores";
import { useWorkspaceInit, useNoteHandlers, useFolderHandlers, useNoteData, useDialogState } from "../hooks";

const NOTE_DRAG_PREFIX = "note-";
const FOLDER_DROP_PREFIX = "folder-";

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
  const [draggingNoteId, setDraggingNoteId] = useState<string | null>(null);

  const moveNote = useNoteStore((state) => state.moveNote);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 }
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const activeId = String(event.active.id);
    if (!activeId.startsWith(NOTE_DRAG_PREFIX)) return;
    setDraggingNoteId(activeId.slice(NOTE_DRAG_PREFIX.length));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggingNoteId(null);
    if (!over?.id || typeof active.id !== "string" || typeof over.id !== "string") return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (!activeId.startsWith(NOTE_DRAG_PREFIX) || !overId.startsWith(FOLDER_DROP_PREFIX)) return;
    const noteId = activeId.slice(NOTE_DRAG_PREFIX.length);
    const targetFolderId = overId.slice(FOLDER_DROP_PREFIX.length);
    void moveNote(noteId, targetFolderId);
  };

  const draggingNote = draggingNoteId ? notes.find((note) => note.id === draggingNoteId) : null;
  const cursorOverlayModifier: Modifier = ({ transform, activeNodeRect, activatorEvent }) => {
    if (!activeNodeRect || !activatorEvent) return transform;

    const event = activatorEvent as MouseEvent | PointerEvent | TouchEvent;
    let pointerX: number | null = null;
    let pointerY: number | null = null;

    if ("clientX" in event && "clientY" in event) {
      pointerX = event.clientX;
      pointerY = event.clientY;
    } else if ("touches" in event && event.touches.length > 0) {
      pointerX = event.touches[0].clientX;
      pointerY = event.touches[0].clientY;
    }

    if (pointerX === null || pointerY === null) {
      return transform;
    }

    const offsetX = pointerX - activeNodeRect.left + 12;
    const offsetY = pointerY - activeNodeRect.top + 10;

    return {
      ...transform,
      x: transform.x + offsetX,
      y: transform.y + offsetY
    };
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={(args) => {
        const pointerCollisions = pointerWithin(args);
        return pointerCollisions.length > 0 ? pointerCollisions : rectIntersection(args);
      }}
      measuring={{
        droppable: {
          strategy: MeasuringStrategy.Always
        }
      }}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDraggingNoteId(null)}
    >
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
            key={selectedFolderId ?? "__all__"}
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
            onPushToGitHub={noteHandlers.handlePushToGitHub}
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
            onPushToGitHub={noteHandlers.handlePushToGitHub}
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
      <DragOverlay adjustScale={false} dropAnimation={null} modifiers={[cursorOverlayModifier]}>
        {draggingNote ? (
          <div className="pointer-events-none cursor-grabbing shadow-xl">
            <ListRow
              selected
              layoutId={undefined}
              leading={<FileText className="h-3.5 w-3.5 shrink-0" />}
              label={<span className="block w-full truncate">{draggingNote.title}</span>}
              align="start"
              className="pointer-events-none w-auto max-w-[min(460px,calc(100vw-48px))]"
              contentClassName="min-w-0"
              labelClassName="truncate"
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
