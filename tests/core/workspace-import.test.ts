import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { IpcResultDTO } from "../../apps/desktop/src/shared";

type ImportResult = { importedCount: number; skippedCount: number; importedPaths: string[] };
type ImportHandler = (
  event: Electron.IpcMainInvokeEvent,
  sourcePaths: string[],
  targetDir: string
) => Promise<IpcResultDTO<ImportResult>>;

const { handlers, caller } = vi.hoisted(() => ({
  handlers: new Map<string, ImportHandler>(),
  caller: { workspacePath: "" }
}));

vi.mock("electron", () => ({
  ipcMain: { handle: (channel: string, handler: ImportHandler) => handlers.set(channel, handler) },
  shell: {},
  BrowserWindow: { fromWebContents: () => ({ id: 1 }) },
  dialog: {},
  app: {}
}));
vi.mock("../../apps/desktop/src/main/window-manager", () => ({
  windowManager: { getEntryByWebContents: () => caller }
}));
vi.mock("../../apps/desktop/src/main/config", () => ({ configManager: {} }));
vi.mock("../../apps/desktop/src/main/file-watcher", () => ({ fileWatcherManager: {} }));
vi.mock("../../apps/desktop/src/main/ipc/watcher-handler", () => ({ registerWatcherHandlers: vi.fn() }));

import { registerWorkspaceHandlers } from "../../apps/desktop/src/main/ipc/workspace-handler";
import { workspaceManager } from "../../apps/desktop/src/main/workspace";

beforeAll(() => registerWorkspaceHandlers());

describe("Markdown file import remains discoverable", () => {
  let root: string;
  let sourceDir: string;
  let workspace: string;
  const event = { sender: {} } as Electron.IpcMainInvokeEvent;

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "zhiyuan-markdown-import-"));
    sourceDir = path.join(root, "source");
    workspace = path.join(root, "workspace");
    await Promise.all([mkdir(sourceDir), mkdir(workspace)]);
    caller.workspacePath = workspace;
  });

  afterEach(async () => rm(root, { recursive: true, force: true }));

  function importFiles(sources: string[]) {
    return handlers.get("workspace:importMarkdownFiles")!(event, sources, workspace);
  }

  it("skips a hidden Markdown file instead of reporting an invisible copy as imported", async () => {
    const source = path.join(sourceDir, ".draft.md");
    await writeFile(source, "hidden draft body");

    expect(await importFiles([source])).toEqual({
      ok: true,
      value: { importedCount: 0, skippedCount: 1, importedPaths: [] }
    });
    expect(await readdir(workspace)).toEqual([]);
    expect((await workspaceManager.scanWorkspace(workspace)).notes).toEqual([]);
    expect(await readFile(source, "utf8")).toBe("hidden draft body");
  });

  it("imports valid Chinese and uppercase-extension files while counting hidden entries as skipped", async () => {
    const hidden = path.join(sourceDir, ".draft.md");
    const visible = path.join(sourceDir, "中文笔记.MD");
    await Promise.all([writeFile(hidden, "hidden"), writeFile(visible, "visible body")]);

    expect(await importFiles([hidden, visible])).toEqual({
      ok: true,
      value: { importedCount: 1, skippedCount: 1, importedPaths: [path.join(workspace, "中文笔记.MD")] }
    });
    expect((await workspaceManager.scanWorkspace(workspace)).notes).toEqual([
      expect.objectContaining({ id: "中文笔记.MD", content: "visible body" })
    ]);
  });

  it("keeps collision naming and both existing and imported contents intact", async () => {
    const source = path.join(sourceDir, "笔记.MD");
    const original = path.join(workspace, "笔记.MD");
    const imported = path.join(workspace, "笔记 (1).MD");
    await Promise.all([writeFile(source, "new body"), writeFile(original, "existing body")]);

    expect(await importFiles([source])).toEqual({
      ok: true,
      value: { importedCount: 1, skippedCount: 0, importedPaths: [imported] }
    });
    expect(await readFile(original, "utf8")).toBe("existing body");
    expect(await readFile(imported, "utf8")).toBe("new body");
    expect((await workspaceManager.scanWorkspace(workspace)).notes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "笔记.MD", content: "existing body" }),
        expect.objectContaining({ id: "笔记 (1).MD", content: "new body" })
      ])
    );
  });

  it("allows note titles that only have a special meaning as directory names", async () => {
    const source = path.join(sourceDir, "dist.md");
    await writeFile(source, "a normal note");

    expect(await importFiles([source])).toMatchObject({
      ok: true,
      value: { importedCount: 1, skippedCount: 0 }
    });
    expect((await workspaceManager.scanWorkspace(workspace)).notes).toEqual([
      expect.objectContaining({ id: "dist.md", content: "a normal note" })
    ]);
  });
});
