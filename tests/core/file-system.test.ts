import fs from "node:fs";
import { chmod, lstat, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
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

  it.skipIf(process.platform === "win32")("preserves a private note's POSIX permission bits", async () => {
    const filePath = path.join(root, "private.md");
    await writeFile(filePath, "private draft");
    await chmod(filePath, 0o600);

    await fileSystem.writeFileAtomic(filePath, "updated private draft");

    expect((await stat(filePath)).mode & 0o777).toBe(0o600);
    expect(await readFile(filePath, "utf8")).toBe("updated private draft");
  });

  it.skipIf(process.platform === "win32")("keeps group permissions and writes new atomic files privately", async () => {
    const existingPath = path.join(root, "shared.md");
    const newPath = path.join(root, "new.md");
    await writeFile(existingPath, "old content");
    await chmod(existingPath, 0o640);

    await fileSystem.writeFileAtomic(existingPath, "new content");
    await fileSystem.writeFileAtomic(newPath, "new private file");

    expect((await stat(existingPath)).mode & 0o777).toBe(0o640);
    expect((await stat(newPath)).mode & 0o777).toBe(0o600);
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
