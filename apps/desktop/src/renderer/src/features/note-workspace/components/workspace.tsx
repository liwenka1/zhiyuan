import { captureNoteLoadSnapshot } from "@/stores/note-store/loaders";
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
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { MainLayout } from "@/layouts/main-layout";
import { useOperationStore } from "@/stores/note-store/operation-guard";
import { moveNotesInWorkspace } from "../lib/move-notes";
import { ListRow } from "@/components/app/list-row";
import { FolderTree } from "./folder-tree";
import { NoteList, type NoteListSelection } from "./note-list";
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
const EMPTY_NOTE_SELECTION: NoteListSelection = { noteIds: [], anchorId: null };

/**
 * 笔记工作区
 * 负责：
 * - 组合各个子组件
 * - 协调业务逻辑
 */
export function NoteWorkspace({
  mainOverlay,
  onOpenNote,
  settingsButton
}: {
  mainOverlay?: ReactNode;
  onOpenNote: (id: string) => void;
  settingsButton: ReactNode;
}) {
  // 初始化工作区和文件监听
  useWorkspaceInit();

  // Dialog 状态管理
  const workspacePath = useWorkspaceStore((state) => state.workspacePath);
  const workspaceRevision = useWorkspaceStore((state) => state.revision);
  const isLoading = useWorkspaceStore((state) => state.isLoading);
  const isOperationPending = useOperationStore((state) => state.fileOperationCount > 0 || state.closeRequestCount > 0);
  const dialogState = useDialogState();
  const { t } = useTranslation("note");

  // Store 状态
  const selectedFolderId = useFolderStore((state) => state.selectedFolderId);
  const selectedNoteId = useNoteStore((state) => state.selectedNoteId);
  const editorContent = useNoteStore((state) => state.editorContent);
  const openNoteIds = useNoteStore((state) => state.openNoteIds);
  const notes = useNoteStore((state) => state.notes);
  const loadFromFileSystem = useNoteStore((state) => state.loadFromFileSystem);
  const folders = useFolderStore((state) => state.folders);
  const selectFolder = useFolderStore((state) => state.selectFolder);
  const setFolders = useFolderStore((state) => state.setFolders);
  const updateNoteContent = useNoteStore((state) => state.updateNoteContent);

  // 笔记操作 handlers
  const noteHandlers = useNoteHandlers({
    onOpenRenameDialog: dialogState.openRenameNoteDialog,
    onOpenCreateNoteDialog: dialogState.openCreateNoteDialog
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
  const [noteSelection, setNoteSelection] = useState(EMPTY_NOTE_SELECTION);
  const { noteIds: selectedNoteIds, anchorId: selectionAnchorId } = noteSelection;
  const visibleNoteIds = useMemo(() => new Set(formattedNotes.map((note) => note.id)), [formattedNotes]);

  useEffect(() => {
    const clearNoteSelection = () => setNoteSelection(EMPTY_NOTE_SELECTION);
    const unsubscribeWorkspace = useWorkspaceStore.subscribe((current, previous) => {
      if (current.workspacePath === previous.workspacePath) return;
      setDraggingNoteId(null);
      setDraggingNoteIds([]);
      clearNoteSelection();
    });
    const unsubscribeFolder = useFolderStore.subscribe((current, previous) => {
      if (current.selectedFolderId !== previous.selectedFolderId) clearNoteSelection();
    });
    const unsubscribeNote = useNoteStore.subscribe((current, previous) => {
      if (current.selectedNoteId !== previous.selectedNoteId) clearNoteSelection();
    });
    window.addEventListener("app:clear-note-selection", clearNoteSelection);
    return () => {
      unsubscribeWorkspace();
      unsubscribeFolder();
      unsubscribeNote();
      window.removeEventListener("app:clear-note-selection", clearNoteSelection);
    };
  }, []);

  const moveNote = useNoteStore((state) => state.moveNote);

  const effectiveSelectedNoteIds = useMemo(
    () => selectedNoteIds.filter((id) => visibleNoteIds.has(id)),
    [selectedNoteIds, visibleNoteIds]
  );

  const isCurrentWorkspace = useCallback(() => {
    const current = useWorkspaceStore.getState();
    return !current.isLoading && current.workspacePath === workspacePath && current.revision === workspaceRevision;
  }, [workspacePath, workspaceRevision]);

  const getVisibleBatchNoteIds = useCallback(
    (noteIds: string[]) => {
      if (!isCurrentWorkspace() || useFolderStore.getState().selectedFolderId !== selectedFolderId) {
        return [];
      }
      return [...new Set(noteIds)].filter((id) => visibleNoteIds.has(id));
    },
    [isCurrentWorkspace, selectedFolderId, visibleNoteIds]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 }
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const activeId = String(event.active.id);
    if (!activeId.startsWith(NOTE_DRAG_PREFIX)) return;
    const noteId = activeId.slice(NOTE_DRAG_PREFIX.length);
    const isDraggingSelected = effectiveSelectedNoteIds.includes(noteId);
    const currentDraggingIds = isDraggingSelected ? effectiveSelectedNoteIds : [noteId];
    setDraggingNoteId(noteId);
    setDraggingNoteIds(currentDraggingIds);
    if (!isDraggingSelected) {
      setNoteSelection({ noteIds: [noteId], anchorId: noteId });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggingNoteId(null);
    setDraggingNoteIds([]);
    const currentWorkspace = useWorkspaceStore.getState();
    if (
      currentWorkspace.isLoading ||
      currentWorkspace.workspacePath !== workspacePath ||
      currentWorkspace.revision !== workspaceRevision
    )
      return;
    if (!over?.id || typeof active.id !== "string" || typeof over.id !== "string") return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (!activeId.startsWith(NOTE_DRAG_PREFIX)) return;
    const noteId = activeId.slice(NOTE_DRAG_PREFIX.length);
    const currentDraggingIds = draggingNoteIds.length > 0 ? draggingNoteIds : [noteId];

    if (overId === EDITOR_DROP_OPEN_ID) {
      if (!mainOverlay) onOpenNote(noteId);
      return;
    }

    if (!overId.startsWith(FOLDER_DROP_PREFIX)) return;
    const targetFolderId = overId.slice(FOLDER_DROP_PREFIX.length);
    if (currentDraggingIds.length <= 1) {
      void moveNote(noteId, targetFolderId);
      return;
    }

    void (async () => {
      const { movedCount, skippedCount, renamedCount, cancelled } = await moveNotesInWorkspace(
        currentDraggingIds,
        targetFolderId,
        moveNote,
        { workspacePath, revision: workspaceRevision }
      );
      if (cancelled) return;
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
      if (useWorkspaceStore.getState().isLoading || useWorkspaceStore.getState().workspacePath !== workspacePath) {
        return { importedCount: 0, skippedCount: sourcePaths.length, importedNoteIds: [] };
      }
      if (!workspacePath) {
        throw new Error("No workspace selected");
      }

      const targetDir = selectedFolderId
        ? (folders.find((folder) => folder.id === selectedFolderId)?.path ?? `${workspacePath}/${selectedFolderId}`)
        : workspacePath;

      const result = await workspaceIpc.importMarkdownFiles(sourcePaths, targetDir);
      if (useWorkspaceStore.getState().workspacePath !== workspacePath) return { ...result, importedNoteIds: [] };
      const beforeScan = captureNoteLoadSnapshot(useNoteStore.getState);
      const refreshed = await workspaceIpc.scan(workspacePath);
      if (useWorkspaceStore.getState().workspacePath !== workspacePath) return { ...result, importedNoteIds: [] };
      const importedNoteIds = (result.importedPaths ?? []).map((filePath) =>
        filePath.replaceAll("\\", "/").replace(`${workspacePath.replaceAll("\\", "/")}/`, "")
      );
      if (refreshed) {
        setFolders(refreshed.folders);
        await loadFromFileSystem(refreshed, workspacePath, beforeScan);
        if (useWorkspaceStore.getState().workspacePath !== workspacePath) return { ...result, importedNoteIds: [] };
      }
      return { ...result, importedNoteIds };
    },
    [folders, loadFromFileSystem, selectedFolderId, setFolders, workspacePath]
  );
  const handleDeleteSelectedNotes = useCallback(
    async (noteIds: string[]) => {
      const uniqueNoteIds = getVisibleBatchNoteIds(noteIds);
      if (uniqueNoteIds.length === 0) return;
      if (uniqueNoteIds.length > 1 && !window.confirm(t("confirmDeleteNotes", { count: uniqueNoteIds.length }))) {
        return;
      }
      const deletingSet = new Set(uniqueNoteIds);

      for (const noteId of uniqueNoteIds) {
        if (!isCurrentWorkspace()) return;
        const target = useNoteStore.getState().notes.find((note) => note.id === noteId);
        if (!target) continue;
        await noteHandlers.handleDeleteNote(target, { skipConfirm: uniqueNoteIds.length > 1 });
      }

      if (!isCurrentWorkspace()) return;
      setNoteSelection(({ noteIds, anchorId }) => ({
        noteIds: noteIds.filter((id) => !deletingSet.has(id)),
        anchorId: anchorId && deletingSet.has(anchorId) ? null : anchorId
      }));
    },
    [getVisibleBatchNoteIds, isCurrentWorkspace, noteHandlers, t]
  );
  const handlePinSelectedNotes = useCallback(
    async (noteIds: string[]) => {
      const uniqueNoteIds = getVisibleBatchNoteIds(noteIds);
      for (const noteId of uniqueNoteIds) {
        if (!isCurrentWorkspace()) return;
        const target = useNoteStore.getState().notes.find((note) => note.id === noteId);
        if (!target || target.isPinned) continue;
        await noteHandlers.handleTogglePinNote(target);
      }
    },
    [getVisibleBatchNoteIds, isCurrentWorkspace, noteHandlers]
  );
  const handleDuplicateSelectedNotes = useCallback(
    async (noteIds: string[]) => {
      const uniqueNoteIds = getVisibleBatchNoteIds(noteIds);
      for (const noteId of uniqueNoteIds) {
        if (!isCurrentWorkspace()) return;
        const target = useNoteStore.getState().notes.find((note) => note.id === noteId);
        if (!target) continue;
        await noteHandlers.handleDuplicateNote(target);
      }
    },
    [getVisibleBatchNoteIds, isCurrentWorkspace, noteHandlers]
  );
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

  if (isLoading) {
    return (
      <div className="bg-background flex h-full items-center justify-center">
        <div role="status" aria-busy="true" className="text-muted-foreground text-sm">
          {t("common:workspace.loading")}
        </div>
      </div>
    );
  }

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
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setDraggingNoteId(null);
        setDraggingNoteIds([]);
      }}
    >
      <MainLayout
        inert={isOperationPending}
        mainOverlay={mainOverlay}
        leftSidebar={
          <FolderTree
            folders={foldersWithCount}
            selectedFolderId={selectedFolderId}
            totalNoteCount={notes.length}
            settingsButton={settingsButton}
            onSelectFolder={selectFolder}
            onCreateFolder={folderHandlers.handleCreateFolder}
            onImportRss={folderHandlers.handleImportRss}
            onUpdateRss={folderHandlers.handleUpdateRss}
            onUnsubscribeRss={folderHandlers.handleUnsubscribeRss}
            onShowFolderInExplorer={folderHandlers.handleShowFolderInExplorer}
            onCopyFolderRelativePath={folderHandlers.handleCopyFolderRelativePath}
            onCopyFolderAbsolutePath={folderHandlers.handleCopyFolderAbsolutePath}
            onDeleteFolder={folderHandlers.handleDeleteFolder}
            onRenameFolder={folderHandlers.handleRenameFolder}
          />
        }
        rightSidebar={
          <NoteList
            key={selectedFolderId ?? "__all__"}
            notes={formattedNotes}
            selectedNoteId={selectedNoteId ?? undefined}
            selectedNoteIds={effectiveSelectedNoteIds}
            selectionAnchorId={selectionAnchorId}
            onSelectNote={onOpenNote}
            onCreateNote={noteHandlers.handleCreateNote}
            onCreateFromUrl={dialogState.openUrlCreateDialog}
            onShowNoteInExplorer={noteHandlers.handleShowNoteInExplorer}
            onCopyNoteRelativePath={noteHandlers.handleCopyNoteRelativePath}
            onCopyNoteAbsolutePath={noteHandlers.handleCopyNoteAbsolutePath}
            onCopyNotesRelativePaths={(noteIds) => {
              const visibleIds = getVisibleBatchNoteIds(noteIds);
              return visibleIds.length ? noteHandlers.handleCopyNotesRelativePaths(visibleIds) : undefined;
            }}
            onCopyNotesAbsolutePaths={(noteIds) => {
              const visibleIds = getVisibleBatchNoteIds(noteIds);
              return visibleIds.length ? noteHandlers.handleCopyNotesAbsolutePaths(visibleIds) : undefined;
            }}
            onDeleteNote={noteHandlers.handleDeleteNote}
            onDeleteNotes={handleDeleteSelectedNotes}
            onRenameNote={noteHandlers.handleRenameNote}
            onDuplicateNote={noteHandlers.handleDuplicateNote}
            onDuplicateNotes={handleDuplicateSelectedNotes}
            onTogglePinNote={noteHandlers.handleTogglePinNote}
            onPinNotes={handlePinSelectedNotes}
            onExportNote={noteHandlers.handleExportNote}
            onCopyToWechat={noteHandlers.handleCopyToWechat}
            onPushToGitHub={noteHandlers.handlePushToGitHub}
            onImportExternalMarkdownFiles={handleImportExternalMarkdownFiles}
            onSelectionChange={setNoteSelection}
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
            onCopyFullText={noteHandlers.handleCopyFullText}
            onExportNote={noteHandlers.handleExportNote}
            onPushToGitHub={noteHandlers.handlePushToGitHub}
            onDeleteNote={noteHandlers.handleDeleteNote}
            onImportExternalMarkdownFiles={handleImportExternalMarkdownFiles}
            onOpenImportedMarkdownNote={onOpenNote}
            noteDropTargetId={EDITOR_DROP_OPEN_ID}
            disableNoteDrop={!!mainOverlay}
          />
        }
      />

      <NoteDialogs
        onOpenNote={onOpenNote}
        showCreateFolderDialog={dialogState.showCreateFolderDialog}
        onCloseCreateFolderDialog={dialogState.closeCreateFolderDialog}
        showCreateNoteDialog={dialogState.showCreateNoteDialog}
        onCloseCreateNoteDialog={dialogState.closeCreateNoteDialog}
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
