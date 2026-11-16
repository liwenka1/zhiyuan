import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));
vi.mock("electron", () => ({ shell: { trashItem: vi.fn() } }));
vi.mock("../../apps/desktop/src/main/security/remote-url", () => ({
  assertSafeRemoteHttpUrl: vi.fn(),
  fetchSafeRemoteHttp: fetchMock
}));

import { importRss, updateRss } from "../../apps/desktop/src/main/rss/import-rss";

function feed(dateXml = ""): string {
  return `<?xml version="1.0"?><rss version="2.0"><channel><title>Test Feed</title><description>Feed</description><link>https://example.com</link><item><title>Undated Article</title><description>Body</description>${dateXml}</item></channel></rss>`;
}

describe("RSS publication dates", () => {
  let workspacePath: string;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-01T12:00:00Z"));
    workspacePath = await mkdtemp(path.join(os.tmpdir(), "zhiyuan-rss-dates-"));
    fetchMock.mockReset();
    fetchMock.mockImplementation(async () => ({ response: new Response(feed()) }));
  });

  afterEach(async () => {
    vi.useRealTimers();
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
});
