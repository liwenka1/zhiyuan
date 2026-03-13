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
import type { DragEndEvent, DragOverEvent, DragStartEvent } from "@dnd-kit/core";
import { FileText } from "lucide-react";
import { useCallback, useState } from "react";
import { MainLayout } from "@/layouts/main-layout";
import { ListRow } from "@/components/app/list-row";
import { FolderTree } from "./folder-tree";
import { NoteList } from "./note-list";
import { NoteDialogs } from "./note-dialogs";
import { EditorArea } from "@/features/editor";
import { useNoteStore, useFolderStore, useWorkspaceStore } from "@/stores";
import { useWorkspaceInit, useNoteHandlers, useFolderHandlers, useNoteData, useDialogState } from "../hooks";
import { workspaceIpc } from "@/ipc";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

const NOTE_DRAG_PREFIX = "note-";
const FOLDER_DROP_PREFIX = "folder-";
const EDITOR_DROP_OPEN_ID = "editor-drop-open";

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
  const { t } = useTranslation("note");

  // Store 状态
  const selectedFolderId = useFolderStore((state) => state.selectedFolderId);
  const selectedNoteId = useNoteStore((state) => state.selectedNoteId);
  const editorContent = useNoteStore((state) => state.editorContent);
  const openNoteIds = useNoteStore((state) => state.openNoteIds);
  const searchKeyword = useNoteStore((state) => state.searchKeyword);
  const notes = useNoteStore((state) => state.notes);
  const loadFromFileSystem = useNoteStore((state) => state.loadFromFileSystem);
  const folders = useFolderStore((state) => state.folders);
  const workspacePath = useWorkspaceStore((state) => state.workspacePath);
  const selectFolder = useFolderStore((state) => state.selectFolder);
  const setFolders = useFolderStore((state) => state.setFolders);
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
  const [draggingNoteIds, setDraggingNoteIds] = useState<string[]>([]);
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  const [isNoteListExternalFileDropHover, setIsNoteListExternalFileDropHover] = useState(false);
  const [isEditorExternalFileDropHover, setIsEditorExternalFileDropHover] = useState(false);
  const [isEditorNoteDragHover, setIsEditorNoteDragHover] = useState(false);

  const moveNote = useNoteStore((state) => state.moveNote);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 }
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const activeId = String(event.active.id);
    if (!activeId.startsWith(NOTE_DRAG_PREFIX)) return;
    const noteId = activeId.slice(NOTE_DRAG_PREFIX.length);
    const isDraggingSelected = selectedNoteIds.includes(noteId);
    const visibleNoteIdSet = new Set(formattedNotes.map((note) => note.id));
    const visibleSelectedNoteIds = selectedNoteIds.filter((id) => visibleNoteIdSet.has(id));
    const currentDraggingIds =
      isDraggingSelected && visibleSelectedNoteIds.length > 0 ? visibleSelectedNoteIds : [noteId];
    setDraggingNoteId(noteId);
    setDraggingNoteIds(currentDraggingIds);
    if (!isDraggingSelected) {
      setSelectedNoteIds([noteId]);
    }
    setIsEditorNoteDragHover(false);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const activeId = String(event.active.id);
    const overId = event.over?.id ? String(event.over.id) : "";
    const isNoteDrag = activeId.startsWith(NOTE_DRAG_PREFIX);
    setIsEditorNoteDragHover(isNoteDrag && overId === EDITOR_DROP_OPEN_ID);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggingNoteId(null);
    setDraggingNoteIds([]);
    setIsEditorNoteDragHover(false);
    if (!over?.id || typeof active.id !== "string" || typeof over.id !== "string") return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (!activeId.startsWith(NOTE_DRAG_PREFIX)) return;
    const noteId = activeId.slice(NOTE_DRAG_PREFIX.length);
    const currentDraggingIds = draggingNoteIds.length > 0 ? draggingNoteIds : [noteId];

    if (overId === EDITOR_DROP_OPEN_ID) {
      selectNote(noteId);
      return;
    }

    if (!overId.startsWith(FOLDER_DROP_PREFIX)) return;
    const targetFolderId = overId.slice(FOLDER_DROP_PREFIX.length);
    if (currentDraggingIds.length <= 1) {
      void moveNote(noteId, targetFolderId);
      return;
    }

    void (async () => {
      let movedCount = 0;
      let skippedCount = 0;
      let renamedCount = 0;
      for (const movingNoteId of currentDraggingIds) {
        const result = await moveNote(movingNoteId, targetFolderId, { silent: true });
        if (result.moved) {
          movedCount += 1;
          if (result.renamed) renamedCount += 1;
        } else {
          skippedCount += 1;
        }
      }
      if (movedCount > 0 && skippedCount === 0) {
        toast.success(
          renamedCount > 0
            ? t("moveNotesSuccessWithRenamed", { count: movedCount, renamedCount })
            : t("moveNotesSuccess", { count: movedCount })
        );
      } else if (movedCount > 0) {
        toast.success(
          renamedCount > 0
            ? t("moveNotesPartialWithRenamed", { movedCount, skippedCount, renamedCount })
            : t("moveNotesPartial", { movedCount, skippedCount })
        );
      } else {
        toast.error(t("errors.moveNoteFailed"));
      }
    })();
  };

  const draggingNote = draggingNoteId ? notes.find((note) => note.id === draggingNoteId) : null;
  const handleImportExternalMarkdownFiles = useCallback(
    async (sourcePaths: string[]) => {
      if (!workspacePath) {
        throw new Error("No workspace selected");
      }

      const targetDir = selectedFolderId
        ? (folders.find((folder) => folder.id === selectedFolderId)?.path ?? `${workspacePath}/${selectedFolderId}`)
        : workspacePath;

      const result = await workspaceIpc.importMarkdownFiles(sourcePaths, targetDir);
      const refreshed = await workspaceIpc.scan(workspacePath);
      const importedNoteIds = (result.importedPaths ?? []).map((filePath) =>
        filePath.replaceAll("\\", "/").replace(`${workspacePath.replaceAll("\\", "/")}/`, "")
      );
      if (refreshed) {
        setFolders(refreshed.folders);
        await loadFromFileSystem(refreshed);
      }
      return { ...result, importedNoteIds };
    },
    [folders, loadFromFileSystem, selectedFolderId, setFolders, workspacePath]
  );
  const handleOpenImportedMarkdownNote = useCallback((noteId: string) => selectNote(noteId), [selectNote]);
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
        if (pointerCollisions.length > 0) return pointerCollisions;
        // Fallback only for folder drop targets. Editor open should require pointer-within.
        return rectIntersection(args).filter(({ id }) => String(id).startsWith(FOLDER_DROP_PREFIX));
      }}
      measuring={{
        droppable: {
          strategy: MeasuringStrategy.Always
        }
      }}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setDraggingNoteId(null);
        setDraggingNoteIds([]);
        setIsEditorNoteDragHover(false);
      }}
    >
      <MainLayout
        showRightSidebarDropMask={isNoteListExternalFileDropHover}
        showMainContentDropMask={isEditorExternalFileDropHover || isEditorNoteDragHover}
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
            selectedNoteIds={selectedNoteIds}
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
            onImportExternalMarkdownFiles={handleImportExternalMarkdownFiles}
            onExternalFileDragHoverChange={setIsNoteListExternalFileDropHover}
            onSelectedNoteIdsChange={setSelectedNoteIds}
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
            onImportExternalMarkdownFiles={handleImportExternalMarkdownFiles}
            onExternalFileDragHoverChange={setIsEditorExternalFileDropHover}
            onOpenImportedMarkdownNote={handleOpenImportedMarkdownNote}
            noteDropTargetId={EDITOR_DROP_OPEN_ID}
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
          <div className="pointer-events-none cursor-grabbing">
            <ListRow
              selected
              layoutId={undefined}
              leading={<FileText className="h-3.5 w-3.5 shrink-0" />}
              label={
                draggingNoteIds.length > 1 ? (
                  <span className="block w-full truncate">
                    {t("drag.selectedCount", { count: draggingNoteIds.length })}
                  </span>
                ) : (
                  <span className="block w-full truncate">{draggingNote.title}</span>
                )
              }
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
