import { access, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fetchMock, trashMock } = vi.hoisted(() => ({ fetchMock: vi.fn(), trashMock: vi.fn() }));
vi.mock("electron", () => ({
  shell: { trashItem: trashMock },
  BrowserWindow: class {},
  dialog: {}
}));
vi.mock("../../apps/desktop/src/main/config", () => ({ configManager: { addRecentWorkspace: vi.fn() } }));
vi.mock("../../apps/desktop/src/main/security/remote-url", () => ({
  assertSafeRemoteHttpUrl: vi.fn(),
  fetchSafeRemoteHttp: fetchMock
}));

import { importRss, unsubscribeRss, updateRss } from "../../apps/desktop/src/main/rss/import-rss";
import { fileSystem } from "../../apps/desktop/src/main/file-system";
import { workspaceManager } from "../../apps/desktop/src/main/workspace";

function feed(dateXml = ""): string {
  return `<?xml version="1.0"?><rss version="2.0"><channel><title>Test Feed</title><description>Feed</description><link>https://example.com</link><item><title>Undated Article</title><description>Body</description>${dateXml}</item></channel></rss>`;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((finish) => (resolve = finish));
  return { promise, resolve };
}

describe("RSS imports and subscription updates", () => {
  let workspacePath: string;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-01T12:00:00Z"));
    workspacePath = await mkdtemp(path.join(os.tmpdir(), "zhiyuan-rss-dates-"));
    fetchMock.mockReset();
    trashMock.mockReset();
    fetchMock.mockImplementation(async () => ({ response: new Response(feed()) }));
    trashMock.mockImplementation((filePath: string) => rm(filePath, { recursive: true, force: true }));
  });

  afterEach(async () => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    await rm(workspacePath, { recursive: true, force: true });
  });

  it("keeps a missing publication date undated instead of substituting the current day", async () => {
    const imported = await importRss("https://example.com/feed", workspacePath);
    const files = await readdir(imported.folderPath);
    const metadata = JSON.parse(await readFile(path.join(imported.folderPath, ".rss.json"), "utf8"));

    expect(files).toContain("undated-Undated Article.md");
    expect(metadata.items).toHaveLength(1);
    expect(metadata.items[0].published).toBeUndefined();
  });

  it.each(["dist", "build", "node_modules"])("imports a feed named %s into a discoverable directory", async (title) => {
    fetchMock.mockImplementation(async () => ({
      response: new Response(feed().replace("<title>Test Feed</title>", `<title>${title}</title>`))
    }));

    const imported = await importRss("https://example.com/feed", workspacePath);
    const scanned = await workspaceManager.scanWorkspace(workspacePath);

    expect(scanned.folders).toEqual([expect.objectContaining({ id: imported.folderName })]);
    expect(scanned.notes).toEqual([
      expect.objectContaining({ id: `${imported.folderName}/undated-Undated Article.md` })
    ]);
  });

  it("does not import the same undated article again after a day changes", async () => {
    const imported = await importRss("https://example.com/feed", workspacePath);
    vi.setSystemTime(new Date("2026-10-02T12:00:00Z"));

    await expect(updateRss(imported.folderPath)).resolves.toEqual({ addedCount: 0 });
    expect((await readdir(imported.folderPath)).filter((name) => name.endsWith(".md"))).toHaveLength(1);
  });

  it("preserves real publication dates while deduplicating later updates", async () => {
    fetchMock.mockImplementation(async () => ({
      response: new Response(feed("<pubDate>Thu, 10 Sep 2026 12:00:00 GMT</pubDate>"))
    }));
    const imported = await importRss("https://example.com/feed", workspacePath);
    vi.setSystemTime(new Date("2026-10-02T12:00:00Z"));

    await expect(updateRss(imported.folderPath)).resolves.toEqual({ addedCount: 0 });
    expect(await readdir(imported.folderPath)).toContain("2026-09-10-Undated Article.md");
  });

  it("owns a different directory for each concurrent import with the same feed title", async () => {
    const results = await Promise.allSettled([
      importRss("https://example.com/first", workspacePath),
      importRss("https://example.com/second", workspacePath)
    ]);
    expect(results.map((result) => result.status)).toEqual(["fulfilled", "fulfilled"]);
    const [first, second] = results.map((result) => {
      if (result.status !== "fulfilled") throw result.reason;
      return result.value;
    });
    expect(first.folderPath).not.toBe(second.folderPath);
    for (const result of [first, second]) {
      expect(await readdir(result.folderPath)).toContain("undated-Undated Article.md");
      expect(JSON.parse(await readFile(path.join(result.folderPath, ".rss.json"), "utf8")).items).toHaveLength(1);
    }
  });

  it("rolls back only its own directory when a concurrent import fails", async () => {
    const bothDirectoryChecks = deferred<void>();
    const successMetadataWritten = deferred<void>();
    const originalExists = fileSystem.exists.bind(fileSystem);
    const originalCreateFile = fileSystem.createFile.bind(fileSystem);
    let directoryChecks = 0;
    vi.spyOn(fileSystem, "exists").mockImplementation(async (filePath) => {
      if (filePath === path.join(workspacePath, "Test Feed")) {
        if (++directoryChecks === 2) bothDirectoryChecks.resolve();
        await bothDirectoryChecks.promise;
        return false;
      }
      return originalExists(filePath);
    });
    fetchMock.mockImplementation(async (url: string) => ({
      response: new Response(url.endsWith("failure") ? feed().replaceAll("Undated Article", "Failure Article") : feed())
    }));
    vi.spyOn(fileSystem, "createFile").mockImplementation(async (filePath, content = "") => {
      if (content.includes("Failure Article")) {
        await successMetadataWritten.promise;
        throw new Error("injected article write failure");
      }
      await originalCreateFile(filePath, content);
      if (filePath.endsWith(".rss.json")) successMetadataWritten.resolve();
    });

    const [success, failure] = await Promise.allSettled([
      importRss("https://example.com/success", workspacePath),
      importRss("https://example.com/failure", workspacePath)
    ]);
    expect(success.status).toBe("fulfilled");
    expect(failure.status).toBe("rejected");
    if (success.status !== "fulfilled") throw success.reason;
    expect(await readdir(workspacePath)).toEqual([success.value.folderName]);
    expect(await readdir(success.value.folderPath)).toContain("undated-Undated Article.md");
    expect(JSON.parse(await readFile(path.join(success.value.folderPath, ".rss.json"), "utf8")).url).toBe(
      "https://example.com/success"
    );
  });

  it("does not restore a subscription after cancelling an update waiting for its response", async () => {
    const imported = await importRss("https://example.com/feed", workspacePath);
    const requestStarted = deferred<void>();
    const response = deferred<{ response: Response }>();
    fetchMock.mockImplementation(() => {
      requestStarted.resolve();
      return response.promise;
    });
    const update = updateRss(imported.folderPath);
    await requestStarted.promise;
    await unsubscribeRss(imported.folderPath);
    await expect(access(path.join(imported.folderPath, ".rss.json"))).rejects.toThrow();
    response.resolve({ response: new Response(feed().replaceAll("Undated Article", "New Article")) });
    await expect(update).rejects.toThrow(/subscription.*changed/i);
    expect(await readdir(imported.folderPath)).toEqual(["undated-Undated Article.md"]);
  });

  it("waits for an in-flight article write before completing unsubscribe and discards its new files", async () => {
    const imported = await importRss("https://example.com/feed", workspacePath);
    fetchMock.mockImplementation(async () => ({
      response: new Response(feed().replaceAll("Undated Article", "New Article"))
    }));
    const articleWritten = deferred<void>();
    const finishWrite = deferred<void>();
    const originalCreateFile = fileSystem.createFile.bind(fileSystem);
    vi.spyOn(fileSystem, "createFile").mockImplementation(async (filePath, content) => {
      await originalCreateFile(filePath, content);
      articleWritten.resolve();
      await finishWrite.promise;
    });
    const update = updateRss(imported.folderPath);
    await articleWritten.promise;
    const unsubscribe = unsubscribeRss(imported.folderPath);
    expect(trashMock).not.toHaveBeenCalled();
    finishWrite.resolve();
    await expect(update).rejects.toThrow(/subscription.*changed/i);
    await unsubscribe;
    expect(await readdir(imported.folderPath)).toEqual(["undated-Undated Article.md"]);
  });

  it("deduplicates overlapping updates against the metadata committed by the first update", async () => {
    const imported = await importRss("https://example.com/feed", workspacePath);
    const bothRequestsStarted = deferred<void>();
    let requests = 0;
    fetchMock.mockImplementation(async () => {
      if (++requests === 2) bothRequestsStarted.resolve();
      await bothRequestsStarted.promise;
      return { response: new Response(feed().replaceAll("Undated Article", "New Article")) };
    });
    const updates = await Promise.all([updateRss(imported.folderPath), updateRss(imported.folderPath)]);
    expect(updates.map((update) => update.addedCount).sort()).toEqual([0, 1]);
    expect((await readdir(imported.folderPath)).filter((name) => name.endsWith(".md"))).toHaveLength(2);
    expect(JSON.parse(await readFile(path.join(imported.folderPath, ".rss.json"), "utf8")).items).toHaveLength(2);
  });

  it("keeps committed article files consistent if a simultaneous unsubscribe cannot delete metadata", async () => {
    const imported = await importRss("https://example.com/feed", workspacePath);
    fetchMock.mockImplementation(async () => ({
      response: new Response(feed().replaceAll("Undated Article", "New Article"))
    }));
    const metadataWritten = deferred<void>();
    const finishWrite = deferred<void>();
    const originalWriteFile = fileSystem.writeFile.bind(fileSystem);
    vi.spyOn(fileSystem, "writeFile").mockImplementation(async (filePath, content) => {
      const result = await originalWriteFile(filePath, content);
      metadataWritten.resolve();
      await finishWrite.promise;
      return result;
    });
    const update = updateRss(imported.folderPath);
    await metadataWritten.promise;
    trashMock.mockRejectedValueOnce(new Error("trash denied"));
    const unsubscribe = unsubscribeRss(imported.folderPath);
    finishWrite.resolve();
    await expect(update).rejects.toThrow(/subscription.*changed/i);
    await expect(unsubscribe).rejects.toThrow("trash denied");
    const metadata = JSON.parse(await readFile(path.join(imported.folderPath, ".rss.json"), "utf8"));
    expect(metadata.items).toHaveLength(2);
    expect(await readFile(path.join(imported.folderPath, "undated-New Article.md"), "utf8")).toContain("New Article");
  });
});
