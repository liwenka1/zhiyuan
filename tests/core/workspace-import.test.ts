import { mkdir, mkdtemp, readFile, readdir, realpath, rm, symlink, writeFile } from "node:fs/promises";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { IpcResultDTO } from "../../apps/desktop/src/shared";
import { RENDERER_URL, trustedIpcEvent } from "./helpers/trusted-ipc-event";

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
  windowManager: { getEntryByWebContents: () => ({ ...caller, rendererUrl: RENDERER_URL }) }
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
  const event = trustedIpcEvent({}) as unknown as Electron.IpcMainInvokeEvent;

  beforeEach(async () => {
    root = await realpath(await mkdtemp(path.join(os.tmpdir(), "zhiyuan-markdown-import-")));
    sourceDir = path.join(root, "source");
    workspace = path.join(root, "workspace");
    await Promise.all([mkdir(sourceDir), mkdir(workspace)]);
    caller.workspacePath = workspace;
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(root, { recursive: true, force: true });
  });

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

  it("retries when another import wins the same destination between candidate selection and copy", async () => {
    const source = path.join(sourceDir, "note.md");
    const original = path.join(workspace, "note.md");
    const retry = path.join(workspace, "note (1).md");
    await writeFile(source, "imported body");
    const copy = fs.promises.copyFile;
    vi.spyOn(fs.promises, "copyFile").mockImplementationOnce(async (sourcePath, destination, mode) => {
      await writeFile(original, "concurrent writer");
      return copy(sourcePath, destination, mode);
    });

    expect(await importFiles([source])).toMatchObject({
      ok: true,
      value: { importedCount: 1, skippedCount: 0, importedPaths: [retry] }
    });
    expect(await Promise.all([readFile(original, "utf8"), readFile(retry, "utf8")])).toEqual([
      "concurrent writer",
      "imported body"
    ]);
  });

  it("returns paths relative to the workspace alias used by the renderer", async () => {
    const alias = path.join(root, "alias");
    await symlink(workspace, alias, process.platform === "win32" ? "junction" : "dir");
    const source = path.join(sourceDir, "note.md");
    await writeFile(source, "imported body");
    caller.workspacePath = alias;

    expect(await handlers.get("workspace:importMarkdownFiles")!(event, [source], alias)).toMatchObject({
      ok: true,
      value: { importedPaths: [path.join(alias, "note.md")] }
    });
    expect(await readFile(path.join(workspace, "note.md"), "utf8")).toBe("imported body");
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
