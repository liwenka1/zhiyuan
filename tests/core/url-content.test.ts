import { createRequire } from "node:module";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));
vi.mock("electron", () => ({ shell: {} }));
vi.mock("../../apps/desktop/src/main/security/remote-url", () => ({
  assertSafeRemoteHttpUrl: vi.fn(),
  fetchSafeRemoteHttp: fetchMock
}));

import { fetchArticleFromUrl } from "../../apps/desktop/src/main/url-fetcher/fetcher";
import { createNoteFromUrl } from "../../apps/desktop/src/main/url-fetcher";
import { fileSystem } from "../../apps/desktop/src/main/file-system";

const requireFromDesktop = createRequire(new URL("../../apps/desktop/package.json", import.meta.url));
const { JSDOM } = requireFromDesktop("jsdom") as { JSDOM: new (html: string) => { window: Window } };

function article(body: string): string {
  return `<html><head><title>Code article</title></head><body><article><h1>Code article</h1><p>${"This article explains a working Python example. ".repeat(30)}</p>${body}</article></body></html>`;
}

describe("web article content fidelity", () => {
  afterEach(() => vi.clearAllMocks());

  it("preserves indentation, tabs and blank lines inside imported code blocks", async () => {
    const code = 'def example():\n    print("first")\n\n\n\tprint("second")\n';
    fetchMock.mockResolvedValue({
      response: new Response(article(`<pre><code>${code}</code></pre>`), { headers: { "content-type": "text/html" } }),
      finalUrl: new URL("https://example.com/article")
    });
    const result = await fetchArticleFromUrl("https://example.com/article");
    const document = new JSDOM(result.content).window.document;
    expect(document.querySelector("pre code")?.textContent).toBe(code);
  });

  it("preserves whitespace between highlighted spans and inside inline code", async () => {
    fetchMock.mockResolvedValue({
      response: new Response(
        article(
          '<pre><code><span>if True:</span>\n<span>    </span><span>print("value")</span>\n</code></pre><p>Inline <code>x    +=\t2</code> example.</p>'
        ),
        { headers: { "content-type": "text/html" } }
      ),
      finalUrl: new URL("https://example.com/article")
    });
    const result = await fetchArticleFromUrl("https://example.com/article");
    const document = new JSDOM(result.content).window.document;
    expect(document.querySelector("pre code")?.textContent).toBe('if True:\n    print("value")\n');
    expect(document.querySelector("p code")?.textContent).toBe("x    +=\t2");
  });

  it("keeps the article when the first candidate is claimed by another writer", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "zhiyuan-web-import-"));
    const createFile = fileSystem.createFile;
    let originalPath = "";
    const create = vi.spyOn(fileSystem, "createFile").mockImplementationOnce(async (filePath, content) => {
      originalPath = filePath;
      await writeFile(filePath, "concurrent writer");
      return createFile(filePath, content);
    });
    try {
      fetchMock.mockResolvedValue({
        response: new Response(article("<p>Article to preserve.</p>"), {
          headers: { "content-type": "text/html" }
        }),
        finalUrl: new URL("https://example.com/article")
      });
      const result = await createNoteFromUrl("https://example.com/article", root);
      expect(result.filePath).toMatch(/Code article-2\.md$/);
      expect(await readFile(result.filePath, "utf8")).toContain("Article to preserve.");
      expect(await readFile(originalPath, "utf8")).toBe("concurrent writer");
    } finally {
      create.mockRestore();
      await rm(root, { recursive: true, force: true });
    }
  });

  it("cancels a response rejected before reading its body", async () => {
    const cancel = vi.fn();
    fetchMock.mockResolvedValue({
      response: new Response(new ReadableStream({ cancel }), { headers: { "content-type": "image/jpeg" } }),
      finalUrl: new URL("https://example.com/image")
    });
    await expect(fetchArticleFromUrl("https://example.com/image")).rejects.toThrow("does not point to an HTML page");
    expect(cancel).toHaveBeenCalledOnce();
  });
});
