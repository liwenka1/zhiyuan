// @vitest-environment jsdom
/// <reference path="../../apps/desktop/src/renderer/src/env.d.ts" />

import { act, createElement, type ComponentProps, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NoteList } from "@/features/note-workspace/components/note-list";
import type { Note } from "@/types";
import { useFolderStore, useNoteStore, useWorkspaceStore } from "@/stores";
import { NoteWorkspace } from "@/features/note-workspace/components/workspace";

type BatchAction = "onPinNotes" | "onDeleteNotes" | "onDuplicateNotes";
type BatchProps = Pick<ComponentProps<typeof NoteList>, BatchAction>;
type ItemAction = (note: Pick<Note, "id">) => Promise<void>;

const { noteList, pinNote, deleteNote, duplicateNote } = vi.hoisted(() => ({
  noteList: vi.fn<(_props: BatchProps) => null>(() => null),
  pinNote: vi.fn<ItemAction>(),
  deleteNote: vi.fn<ItemAction>(),
  duplicateNote: vi.fn<ItemAction>()
}));

vi.mock("@/stores", async () => ({
  ...(await import("@/stores/use-workspace-store")),
  ...(await import("@/stores/use-folder-store")),
  ...(await import("@/stores/note-store"))
}));
vi.mock("@/ipc", () => ({ workspaceIpc: {}, fileIpc: {}, folderIpc: {}, configIpc: {}, watcherIpc: {} }));
vi.mock("@/lib/formatter", () => ({ formatMarkdown: vi.fn() }));
vi.mock("@/lib/i18n", () => ({ default: { t: (key: string) => key } }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/features/note-workspace/hooks", async () => ({
  useNoteData: (await import("@/features/note-workspace/hooks/use-note-data")).useNoteData,
  useWorkspaceInit: () => {},
  useDialogState: () => ({}),
  useFolderHandlers: () => ({}),
  useNoteHandlers: () => ({
    handleTogglePinNote: pinNote,
    handleDeleteNote: deleteNote,
    handleDuplicateNote: duplicateNote
  })
}));
vi.mock("@/layouts/main-layout", () => ({
  MainLayout: ({ rightSidebar }: { rightSidebar: ReactNode }) => rightSidebar
}));
vi.mock("@/features/note-workspace/components/folder-tree", () => ({ FolderTree: () => null }));
vi.mock("@/features/note-workspace/components/note-dialogs", () => ({ NoteDialogs: () => null }));
vi.mock("@/features/note-workspace/components/note-list", () => ({ NoteList: noteList }));
vi.mock("@/features/editor", () => ({ EditorArea: () => null }));

const first = "source/first.md";
const second = "source/second.md";
const hidden = "other/hidden.md";
const targets = [first, first, hidden, second];
const workspacePath = "/workspace-a";

function batchAction(name: BatchAction) {
  const action = noteList.mock.lastCall?.[0][name];
  if (!action) throw new Error(`NoteList did not receive ${name}`);
  return action;
}

async function openWorkspace(path: string) {
  await useWorkspaceStore.getState().setWorkspacePath(path);
  useWorkspaceStore.getState().setLoading(false);
}

describe.each([
  ["pin", "onPinNotes", pinNote],
  ["delete", "onDeleteNotes", deleteNote],
  ["duplicate", "onDuplicateNotes", duplicateNote]
] as const)("batch %s", (_label, actionName, itemAction) => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    noteList.mockClear();
    itemAction.mockReset();
    itemAction.mockResolvedValue(undefined);
    await openWorkspace(workspacePath);
    useFolderStore.getState().selectFolder("source");
    useNoteStore.setState({
      notes: [first, second, hidden].map((id) => ({ id, title: id, content: "", folderId: id.split("/")[0] }))
    });
    container = document.body.appendChild(document.createElement("div"));
    root = createRoot(container);
    await act(() => root.render(createElement(NoteWorkspace, { onOpenNote: () => {}, settingsButton: null })));
  });

  afterEach(async () => {
    await act(() => root.unmount());
    container.remove();
    useWorkspaceStore.setState(useWorkspaceStore.getInitialState());
    useFolderStore.setState(useFolderStore.getInitialState());
    useNoteStore.setState(useNoteStore.getInitialState());
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("rejects a stale callback from the previously displayed folder", async () => {
    const action = batchAction(actionName);
    await act(() => useFolderStore.getState().selectFolder("other"));
    await act(() => action(targets));
    expect(itemAction).not.toHaveBeenCalled();
  });

  it.each([
    {
      scenario: "continues with the original targets after folder navigation",
      navigate: () => useFolderStore.getState().selectFolder("other"),
      expected: [first, second]
    },
    {
      scenario: "stops after switching workspaces, even when the original workspace reopens",
      navigate: async () => {
        await openWorkspace("/workspace-b");
        await openWorkspace(workspacePath);
      },
      expected: [first]
    }
  ])("$scenario", async ({ navigate, expected }) => {
    let finishFirstNote!: () => void;
    const firstOperation = new Promise<void>((resolve) => {
      finishFirstNote = resolve;
    });
    itemAction.mockReturnValueOnce(firstOperation);
    const action = batchAction(actionName);
    const batch = action(targets);

    expect(itemAction.mock.calls.map(([note]) => note.id)).toEqual([first]);
    await act(navigate);
    await act(async () => {
      finishFirstNote();
      await batch;
    });

    expect(itemAction.mock.calls.map(([note]) => note.id)).toEqual(expected);
  });
});
