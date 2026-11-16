import fs from "node:fs";
import { lstat, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({ shell: { trashItem: vi.fn() } }));
import { fileSystem } from "../../apps/desktop/src/main/file-system";

describe("atomic note writes", () => {
  let root: string;
  const originalPlatform = process.platform;

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "zhiyuan-atomic-write-"));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    Object.defineProperty(process, "platform", { value: originalPlatform });
    await rm(root, { recursive: true, force: true });
  });

  it("replaces an existing note with the complete new content", async () => {
    const filePath = path.join(root, "note.md");
    await writeFile(filePath, "old content");

    await fileSystem.writeFileAtomic(filePath, "new content");

    expect(await readFile(filePath, "utf8")).toBe("new content");
    expect(await readdir(root)).toEqual(["note.md"]);
  });

  it.each(["EPERM", "EEXIST"])("keeps the original note if replacement fails with %s on Windows", async (code) => {
    const filePath = path.join(root, "note.md");
    await writeFile(filePath, "original draft");
    Object.defineProperty(process, "platform", { value: "win32" });
    const error = Object.assign(new Error("replacement denied"), { code });
    vi.spyOn(fs.promises, "rename").mockRejectedValue(error);

    await expect(fileSystem.writeFileAtomic(filePath, "new draft")).rejects.toThrow("replacement denied");

    expect(await readFile(filePath, "utf8")).toBe("original draft");
    expect(await readdir(root)).toEqual(["note.md"]);
  });

  it("supports case-only file and folder renames on the current filesystem", async () => {
    const filePath = path.join(root, "note.md");
    const renamedFile = path.join(root, "Note.md");
    await writeFile(filePath, "original");
    await fileSystem.renameFile(filePath, renamedFile);
    expect(await readFile(renamedFile, "utf8")).toBe("original");

    const folderPath = path.join(root, "notes");
    await mkdir(folderPath);
    await fileSystem.renameFolder(folderPath, path.join(root, "Notes"));
    expect((await readdir(root)).sort()).toEqual(["Note.md", "Notes"]);
  });

  it("rejects a case-only rename when the destination identifies a different file", async () => {
    const firstPath = path.join(root, "note.md");
    const otherPath = path.join(root, "other.md");
    await writeFile(firstPath, "first");
    await writeFile(otherPath, "other");
    const firstStat = await lstat(firstPath);
    const otherStat = await lstat(otherPath);
    Object.defineProperty(process, "platform", { value: "win32" });
    vi.spyOn(fileSystem, "exists").mockResolvedValue(true);
    vi.spyOn(fs.promises, "lstat").mockResolvedValueOnce(firstStat).mockResolvedValueOnce(otherStat);
    const renameSpy = vi.spyOn(fs.promises, "rename");

    await expect(fileSystem.renameFile(firstPath, path.join(root, "Note.md"))).rejects.toThrow("already exists");
    expect(renameSpy).not.toHaveBeenCalled();
  });
});
