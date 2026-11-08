import fs from "node:fs";
import { mkdir, mkdtemp, rm, writeFile, utimes } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  BrowserWindow: class BrowserWindow {},
  dialog: { showOpenDialog: vi.fn() }
}));

vi.mock("../../apps/desktop/src/main/config", () => ({
  configManager: {
    addRecentWorkspace: vi.fn()
  }
}));

vi.mock("../../apps/desktop/src/main/file-system", () => ({
  fileSystem: {
    exists: async (targetPath: string) => {
      try {
        await fs.promises.access(targetPath);
        return true;
      } catch {
        return false;
      }
    }
  }
}));

import { workspaceManager } from "../../apps/desktop/src/main/workspace";
import { MAX_WORKSPACE_DEPTH } from "../../apps/desktop/src/main/workspace/policy";

describe("workspace scanning", () => {
  let workspacePath: string;

  beforeEach(async () => {
    workspacePath = await mkdtemp(path.join(os.tmpdir(), "zhiyuan-workspace-scan-"));
  });

  afterEach(async () => {
    await rm(workspacePath, { recursive: true, force: true });
  });

  it("discovers nested markdown files and ignores generated or hidden trees", async () => {
    await mkdir(path.join(workspacePath, "notes", "deep"), { recursive: true });
    await mkdir(path.join(workspacePath, "node_modules", "dependency"), { recursive: true });
    await mkdir(path.join(workspacePath, "dist"), { recursive: true });
    await mkdir(path.join(workspacePath, ".hidden"), { recursive: true });
    await writeFile(path.join(workspacePath, "root.md"), "root");
    await writeFile(path.join(workspacePath, "notes", "deep", "nested.md"), "nested");
    await writeFile(path.join(workspacePath, "node_modules", "dependency", "ignored.md"), "ignored");
    await writeFile(path.join(workspacePath, "dist", "ignored.md"), "ignored");
    await writeFile(path.join(workspacePath, ".hidden", "ignored.md"), "ignored");

    const result = await workspaceManager.scanWorkspace(workspacePath);

    expect(result.notes.map((note) => note.id).sort()).toEqual(["notes/deep/nested.md", "root.md"]);
    expect(result.folders.map((folder) => folder.id).sort()).toEqual(["notes", "notes/deep"]);
    expect(result.folders.find((folder) => folder.id === "notes")?.noteCount).toBe(0);
    expect(result.folders.find((folder) => folder.id === "notes/deep")?.noteCount).toBe(1);
  });

  it("stops recursive discovery at the configured depth", async () => {
    let directoryPath = workspacePath;
    const segments: string[] = [];
    for (let index = 0; index < MAX_WORKSPACE_DEPTH + 2; index += 1) {
      const segment = `level-${index}`;
      segments.push(segment);
      directoryPath = path.join(directoryPath, segment);
      await mkdir(directoryPath);
    }
    await writeFile(path.join(directoryPath, "too-deep.md"), "too deep");

    const result = await workspaceManager.scanWorkspace(workspacePath);

    expect(result.folders.every((folder) => folder.id.split("/").length <= MAX_WORKSPACE_DEPTH)).toBe(true);
    expect(result.notes.some((note) => note.id === `${segments.join("/")}/too-deep.md`)).toBe(false);
  });

  it("reuses unchanged note content from the scan cache", async () => {
    const notePath = path.join(workspacePath, "cached.md");
    await writeFile(notePath, "cached content");
    const readFileSpy = vi.spyOn(fs.promises, "readFile");

    try {
      await workspaceManager.scanWorkspace(workspacePath);
      await workspaceManager.scanWorkspace(workspacePath);

      expect(readFileSpy).toHaveBeenCalledTimes(1);

      await writeFile(notePath, "updated content");
      const now = new Date(Date.now() + 2_000);
      await utimes(notePath, now, now);
      await workspaceManager.scanWorkspace(workspacePath);

      expect(readFileSpy).toHaveBeenCalledTimes(2);
    } finally {
      readFileSpy.mockRestore();
    }
  });
});
