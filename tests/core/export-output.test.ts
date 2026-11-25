import fs, { mkdir, mkdtemp, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { IpcResultDTO } from "../../apps/desktop/src/shared";

type Handler = (event: Electron.IpcMainInvokeEvent, ...args: unknown[]) => Promise<IpcResultDTO<unknown>>;
const { handlers, capture, saveDialog, reviewDialog, current } = vi.hoisted(() => ({
  handlers: new Map<string, Handler>(),
  capture: vi.fn(),
  saveDialog: vi.fn(),
  reviewDialog: vi.fn(),
  current: { workspace: "/test-workspace" }
}));
vi.mock("../../apps/desktop/src/main/security/app-ipc", () => ({
  handleAppIpc: (channel: string, handler: Handler) => handlers.set(channel, handler)
}));
vi.mock("../../apps/desktop/src/main/security/window-context", () => ({
  getCallerWorkspace: () => current.workspace,
  getCallerWorkspaceScope: () => ({ workspacePath: current.workspace }),
  getCallerResourceToken: () => "window-token"
}));
vi.mock("../../apps/desktop/src/main/export/capture", () => ({
  captureHtmlAsImage: capture,
  validateExportImages: vi.fn()
}));
vi.mock("electron", () => ({
  BrowserWindow: { fromWebContents: () => ({}) },
  dialog: { showSaveDialog: saveDialog, showMessageBox: reviewDialog },
  app: { getLocale: () => "en" },
  clipboard: {}
}));

import { registerExportHandlers } from "../../apps/desktop/src/main/export/handlers";
import * as exclusiveRename from "../../apps/desktop/src/main/file-system/exclusive-rename";
import {
  inspectExportDestination,
  writeExportDirectory,
  writeExportFile
} from "../../apps/desktop/src/main/export/output";

beforeAll(registerExportHandlers);

describe("export output", () => {
  let root: string;
  const event = { senderFrame: {} } as Electron.IpcMainInvokeEvent;

  function invoke(channel: string, ...args: unknown[]) {
    return handlers.get(`export:${channel}`)!(event, ...args);
  }

  async function select(outputPath: string, language?: "en" | "zh") {
    saveDialog.mockResolvedValueOnce({ canceled: false, filePath: outputPath });
    await expect(invoke("show-save-dialog", { defaultPath: outputPath, language })).resolves.toEqual({
      ok: true,
      value: outputPath
    });
  }

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "zhiyuan-export-output-"));
    current.workspace = path.join(root, "workspace");
    capture.mockReset();
    reviewDialog.mockReset();
    capture.mockImplementation(async (html: string) => ({ toPNG: () => Buffer.from(html) }));
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(root, { recursive: true, force: true });
  });

  it("removes all staged pages on failure and can retry to the same target", async () => {
    const output = path.join(root, "pages");
    await select(output);
    capture.mockResolvedValueOnce({ toPNG: () => Buffer.from("first") });
    capture.mockRejectedValueOnce(new Error("second page failed"));

    expect(await invoke("export-as-image-pages", ["first", "second"], output, "note")).toMatchObject({
      ok: false,
      error: { message: "second page failed" }
    });
    expect(await readdir(root)).toEqual([]);

    await select(output);
    const files = [path.join(output, "note-1.png"), path.join(output, "note-2.png")];
    expect(await invoke("export-as-image-pages", ["first", "second"], output, "note")).toEqual({
      ok: true,
      value: { filesCount: 2, filePaths: files }
    });
    expect(await Promise.all(files.map((file) => readFile(file, "utf8")))).toEqual(["first", "second"]);
    expect(await readdir(root)).toEqual(["pages"]);
  });

  it("keeps the user's existing directory and index intact during HTML export", async () => {
    const output = path.join(root, "existing");
    const index = path.join(output, "index.html");
    await mkdir(output);
    await writeFile(index, "original HTML");
    await select(output);

    expect(await invoke("export-html-package", "export content", output)).toMatchObject({
      ok: false,
      error: { message: expect.stringContaining("already exists") }
    });
    expect(await readFile(index, "utf8")).toBe("original HTML");
    expect(await readdir(output)).toEqual(["index.html"]);
  });

  it("reviews external resources once for each HTML export and removes unshipped local URLs", async () => {
    await mkdir(current.workspace);
    const source = path.join(root, "external.svg");
    await writeFile(source, "<svg></svg>");
    const notePath = path.join(current.workspace, "note.md");
    const html = `<img alt="Figure" src="../external.svg"><a href="../private.txt">Private</a><img src="https://example.com/figure.png">`;

    for (const include of [true, false]) {
      const output = path.join(root, include ? "with-figure" : "without-figure");
      await select(output);
      reviewDialog.mockResolvedValueOnce({ response: 0, checkboxChecked: include });
      expect(await invoke("export-html-package", html, output, notePath)).toMatchObject({ ok: true });
      expect(reviewDialog).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
          detail: expect.stringContaining("external.svg"),
          checkboxChecked: false
        })
      );
      const exported = await readFile(path.join(output, "index.html"), "utf8");
      expect(exported).not.toContain("../external.svg");
      expect(exported).not.toContain("private.txt");
      expect(exported).toContain("https://example.com/figure.png");
      expect(await readdir(path.join(output, "assets"))).toEqual(include ? ["external.svg"] : []);
      expect(exported).toContain(include ? "./assets/external.svg" : "Figure (Omitted from export)");
    }
    expect(reviewDialog).toHaveBeenCalledTimes(2);
  });

  it("publishes no HTML package if the external file is replaced during confirmation", async () => {
    await mkdir(current.workspace);
    const source = path.join(root, "external.svg");
    const output = path.join(root, "package");
    const notePath = path.join(current.workspace, "note.md");
    const html = '<img src="../external.svg">';
    await writeFile(source, "reviewed file");
    await select(output);
    reviewDialog.mockImplementationOnce(async () => {
      await rename(source, path.join(root, "reviewed.svg"));
      await writeFile(source, "replacement file");
      return { response: 0, checkboxChecked: true };
    });

    expect(await invoke("export-html-package", html, output, notePath)).toMatchObject({
      ok: false,
      error: { message: "Export asset changed: external.svg" }
    });
    await expect(stat(output)).rejects.toMatchObject({ code: "ENOENT" });

    await select(output);
    reviewDialog.mockResolvedValueOnce({ response: 0, checkboxChecked: true });
    expect(await invoke("export-html-package", html, output, notePath)).toMatchObject({ ok: true });
    expect(await readFile(path.join(output, "assets", "external.svg"), "utf8")).toBe("replacement file");
  });

  it("reports an unreadable file before saving, using the selected app language in the dialog and output", async () => {
    await mkdir(current.workspace);
    const workspace = await fs.realpath(current.workspace);
    const blocked = path.join(workspace, "blocked.svg");
    await writeFile(blocked, "unreadable fixture");
    await writeFile(path.join(workspace, "readable.svg"), "<svg></svg>");
    const actualOpen = fs.open;
    vi.spyOn(fs, "open").mockImplementation((file, ...options) =>
      file === blocked
        ? Promise.reject(Object.assign(new Error("Permission denied"), { code: "EACCES" }))
        : actualOpen(file, ...options)
    );
    const html = '<img alt="Blocked" src="./blocked.svg"><img alt="Available" src="./readable.svg">';
    const notePath = path.join(workspace, "note.md");
    const output = path.join(root, "reviewed");
    await select(output, "zh");
    reviewDialog.mockResolvedValueOnce({ response: 0, checkboxChecked: false });

    expect(await invoke("export-html-package", html, output, notePath)).toMatchObject({ ok: true });
    expect(reviewDialog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        title: "检查导出资源",
        detail: expect.stringContaining("blocked.svg (无法读取文件)")
      })
    );
    expect(await readdir(path.join(output, "assets"))).toEqual(["readable.svg"]);
    expect(await readFile(path.join(output, "index.html"), "utf8")).toContain("Blocked (未纳入导出)");
    expect(await invoke("prepare-html-preview", html, notePath, "未纳入导出")).toMatchObject({
      ok: true,
      value: expect.stringContaining("Blocked (未纳入导出)")
    });
  });

  it.skipIf(process.platform === "win32")(
    "publishes with ordinary directory permissions from a private staging area",
    async () => {
      const output = path.join(root, "published");
      const regular = path.join(root, "regular");
      await mkdir(regular);
      const stagedFile = await writeExportDirectory(output, async (stagedOutput) => {
        const privateDirectory = await stat(path.dirname(stagedOutput));
        expect(privateDirectory.mode & 0o077).toBe(0);
        await expect(stat(output)).rejects.toMatchObject({ code: "ENOENT" });
        const source = path.join(stagedOutput, "index.html");
        await writeFile(source, "exported");
        return stat(source);
      });

      expect((await stat(output)).mode & 0o777).toBe((await stat(regular)).mode & 0o777);
      const index = path.join(output, "index.html");
      expect(await stat(index)).toMatchObject({ dev: stagedFile.dev, ino: stagedFile.ino, nlink: 1 });
      expect(await readFile(index, "utf8")).toBe("exported");
      expect((await readdir(root)).sort()).toEqual(["published", "regular"]);
    }
  );

  it("publishes exclusively and removes staging when the volume cannot hard-link files", async () => {
    vi.spyOn(fs, "link").mockRejectedValue(Object.assign(new Error("Unsupported hard links"), { code: "ENOTSUP" }));
    const outputPath = path.join(root, "export.html");
    const destination = await inspectExportDestination(outputPath);
    await writeExportFile(destination, "exported");
    await expect(writeExportFile(destination, "later export")).rejects.toThrow("destination changed");
    expect(await readFile(outputPath, "utf8")).toBe("exported");
    expect(await readdir(root)).toEqual(["export.html"]);
  });

  it("exports a new file to a directory that permits files but denies creating directories", async () => {
    const denyDirectory = vi
      .spyOn(fs, "mkdtemp")
      .mockRejectedValue(Object.assign(new Error("Cannot create directories"), { code: "EACCES" }));
    const outputPath = path.join(root, "export.png");
    const destination = await inspectExportDestination(outputPath);
    await writeExportFile(destination, Buffer.from("image"));
    expect(denyDirectory).not.toHaveBeenCalled();
    expect(await readFile(outputPath, "utf8")).toBe("image");
    expect(await readdir(root)).toEqual(["export.png"]);
  });

  it.each([false, true])("preserves a competing export directory with fallback=%s", async (fallback) => {
    const output = path.join(root, "pages");
    if (fallback) {
      vi.spyOn(exclusiveRename, "renameExclusive").mockRejectedValueOnce(
        Object.assign(new Error("Unsupported exclusive rename"), { code: "ENOTSUP" })
      );
    }
    await expect(
      writeExportDirectory(output, async (staged) => {
        for (const page of ["one.png", "two.png"]) await writeFile(path.join(staged, page), "staged page");
        await mkdir(output);
        await writeFile(path.join(output, "unrelated.png"), "user file");
      })
    ).rejects.toThrow("already exists");
    expect(await readdir(output)).toEqual(["unrelated.png"]);
    expect(await readFile(path.join(output, "unrelated.png"), "utf8")).toBe("user file");
    expect(await readdir(root)).toEqual(["pages"]);
  });

  it("rolls back and retries when the export volume supports neither exclusive rename nor hard links", async () => {
    const output = path.join(root, "pages");
    const failure = Object.assign(new Error("Volume is full"), { code: "ENOSPC" });
    vi.spyOn(exclusiveRename, "renameExclusive").mockRejectedValue(
      Object.assign(new Error("Unsupported exclusive rename"), { code: "ENOTSUP" })
    );
    vi.spyOn(fs, "link").mockRejectedValue(Object.assign(new Error("Unsupported hard links"), { code: "ENOTSUP" }));
    const open = fs.open;
    vi.spyOn(fs, "open").mockImplementationOnce(open).mockRejectedValueOnce(failure);
    const prepare = async (staged: string) => {
      const assets = path.join(staged, "assets");
      await mkdir(assets);
      await writeFile(path.join(assets, "index.html"), "contents");
      await writeFile(path.join(assets, "poster.png"), "image");
    };

    await expect(writeExportDirectory(output, prepare)).rejects.toThrow(failure);
    expect(await readdir(root)).toEqual([]);
    await writeExportDirectory(output, prepare);
    const assets = path.join(output, "assets");
    expect(await readFile(path.join(assets, "index.html"), "utf8")).toBe("contents");
    expect(await readFile(path.join(assets, "poster.png"), "utf8")).toBe("image");
    expect(await readdir(root)).toEqual(["pages"]);
  });

  it("aborts fallback publication if another directory replaces the reserved one", async () => {
    const output = path.join(root, "pages");
    const moved = path.join(root, "moved");
    vi.spyOn(exclusiveRename, "renameExclusive").mockRejectedValueOnce(
      Object.assign(new Error("Unsupported exclusive rename"), { code: "ENOTSUP" })
    );
    const linkFile = fs.link;
    const link = vi.spyOn(fs, "link").mockImplementationOnce(async (source, destination) => {
      await linkFile(source, destination);
      await rename(output, moved);
      await mkdir(output);
      await writeFile(path.join(output, "unrelated.png"), "user file");
    });

    await expect(
      writeExportDirectory(output, async (staged) => {
        for (const page of ["one.png", "two.png"]) await writeFile(path.join(staged, page), "staged page");
      })
    ).rejects.toThrow("destination changed");
    expect(link).toHaveBeenCalledTimes(1);
    expect(await readdir(output)).toEqual(["unrelated.png"]);
    expect(await readFile(path.join(output, "unrelated.png"), "utf8")).toBe("user file");
    expect((await readdir(root)).sort()).toEqual(["moved", "pages"]);
  });

  it("leaves the destination free to retry after publication fails", async () => {
    const output = path.join(root, "pages");
    const failure = Object.assign(new Error("Publication failed"), { code: "EIO" });
    vi.spyOn(exclusiveRename, "renameExclusive").mockRejectedValueOnce(failure);
    const prepare = async (staged: string) => {
      const assets = path.join(staged, "assets");
      await mkdir(assets);
      await writeFile(path.join(assets, "page.png"), "exported");
    };

    await expect(writeExportDirectory(output, prepare)).rejects.toThrow(failure);
    expect(await readdir(root)).toEqual([]);
    await writeExportDirectory(output, prepare);
    expect(await readFile(path.join(output, "assets", "page.png"), "utf8")).toBe("exported");
    expect(await readdir(root)).toEqual(["pages"]);
  });

  it("overwrites the approved inode without losing its access controls", async () => {
    const output = path.join(root, "export.html");
    await writeFile(output, "old HTML", { mode: 0o640 });
    const previous = await stat(output);
    await select(output);
    expect(await invoke("save-html-file", output, "新")).toMatchObject({ ok: true });
    expect(await invoke("save-html-file", output, "second save")).toMatchObject({ ok: false });
    expect(await stat(output)).toMatchObject({ dev: previous.dev, ino: previous.ino, mode: previous.mode });
    expect(await readFile(output, "utf8")).toBe("新");
    expect(await readdir(root)).toEqual(["export.html"]);
  });

  it("reserves the directory even when both writers prepare empty outputs", async () => {
    const output = path.join(root, "same-folder");
    let release!: () => void;
    const prepared = new Promise<void>((resolve) => (release = resolve));
    let preparedCount = 0;
    const prepare = async () => {
      preparedCount++;
      if (preparedCount === 2) release();
      await prepared;
    };

    const results = await Promise.allSettled([
      writeExportDirectory(output, prepare),
      writeExportDirectory(output, prepare)
    ]);

    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect(results).toContainEqual({
      status: "rejected",
      reason: expect.objectContaining({ message: expect.stringContaining("already exists") })
    });
    expect(await readdir(root)).toEqual(["same-folder"]);
  });

  it("rejects an overwrite if the selected file was replaced before export", async () => {
    const output = path.join(root, "existing.html");
    const moved = path.join(root, "moved.html");
    await writeFile(output, "original file");
    await select(output);
    await rename(output, moved);
    await writeFile(output, "other file");

    expect(await invoke("save-html-file", output, "exported")).toMatchObject({
      ok: false,
      error: { message: expect.stringContaining("destination changed") }
    });
    expect(await readFile(moved, "utf8")).toBe("original file");
    expect(await readFile(output, "utf8")).toBe("other file");
  });

  it("preserves a user file added after destination selection while a capture is running", async () => {
    const output = path.join(root, "capture.png");
    await select(output);
    capture.mockImplementationOnce(async () => {
      await writeFile(output, "concurrent writer");
      return { toPNG: () => Buffer.from("image") };
    });

    expect(await invoke("export-as-image", "<p>capture</p>", output)).toMatchObject({
      ok: false,
      error: { message: expect.stringContaining("destination changed") }
    });
    expect(await readFile(output, "utf8")).toBe("concurrent writer");
    expect(await readdir(root)).toEqual(["capture.png"]);
  });

  it.each([false, true])("allows one concurrent export to a destination with existing=%s", async (existing) => {
    const output = path.join(root, "concurrent.html");
    if (existing) await writeFile(output, "approved earlier file");
    const first = await inspectExportDestination(output);
    const second = await inspectExportDestination(output);
    const versions = ["first export", "other export"];

    const results = await Promise.allSettled([
      writeExportFile(first, versions[0]),
      writeExportFile(second, versions[1])
    ]);

    const winner = results.findIndex((result) => result.status === "fulfilled");
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results[1 - winner]).toMatchObject({ status: "rejected", reason: expect.any(Error) });
    expect(await readFile(output, "utf8")).toBe(versions[winner]);
    expect(await readdir(root)).toEqual(["concurrent.html"]);
  });
});
