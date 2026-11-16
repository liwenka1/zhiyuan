import fs from "node:fs";
import { createRequire } from "node:module";
import { afterEach, describe, expect, it, vi } from "vitest";

const requireFromDesktop = createRequire(new URL("../../apps/desktop/package.json", import.meta.url));
const { JSDOM } = requireFromDesktop("jsdom") as {
  JSDOM: new () => { window: Window & { DOMParser: typeof DOMParser; close: () => void } };
};

describe("rendering dependency security and compatibility", () => {
  let closeDom: (() => void) | undefined;
  afterEach(() => {
    closeDom?.();
    closeDom = undefined;
    vi.unstubAllGlobals();
  });

  it("does not let an inherited trust option enable KaTeX links", () => {
    const katex = requireFromDesktop("katex") as {
      renderToString: (source: string, options: { trust?: boolean }) => string;
    };
    const original = Object.getOwnPropertyDescriptor(Object.prototype, "trust");
    try {
      Object.defineProperty(Object.prototype, "trust", { value: true, writable: true, configurable: true });
      const source = String.raw`\href{https://example.com}{x}`;
      expect(katex.renderToString(source, {})).not.toContain('href="https://example.com"');
      expect(katex.renderToString(source, { trust: true })).toContain('href="https://example.com"');
    } finally {
      if (original) Object.defineProperty(Object.prototype, "trust", original);
      else Reflect.deleteProperty(Object.prototype, "trust");
    }
  });

  it("renders actual Markdown formulas with the matching packaged KaTeX CSS", async () => {
    const dom = new JSDOM();
    closeDom = () => dom.window.close();
    vi.stubGlobal("DOMParser", dom.window.DOMParser);
    const { buildExportDocument } =
      await import("../../apps/desktop/src/renderer/src/features/export/lib/export-pipeline");
    const html = await buildExportDocument(
      { id: "math", title: "Math", content: "Inline $x^2$.\n\n$$\n\\frac{a}{b}=\\sqrt{x^2+y^2}\n$$" },
      "html",
      "default"
    );
    const document = new DOMParser().parseFromString(html, "text/html");
    const css = fs.readFileSync(requireFromDesktop.resolve("katex/dist/katex.min.css"), "utf8");
    // Vitest 默认 stub CSS 导入，直接读取真实包样式核对生成节点的选择器。
    expect(document.querySelector(".katex-error")).toBeNull();
    expect(document.querySelectorAll(".katex")).toHaveLength(2);
    for (const className of ["katex-display", "katex-html", "katex-mathml", "katex-base"]) {
      expect(document.querySelector(`.${className}`)).not.toBeNull();
      expect(css).toContain(`.${className}`);
    }
  });

  it("initializes Mermaid and parses valid diagrams while rejecting invalid syntax", async () => {
    const dom = new JSDOM();
    closeDom = () => dom.window.close();
    vi.stubGlobal("window", dom.window);
    vi.stubGlobal("document", dom.window.document);
    const { default: mermaid } = (await import(requireFromDesktop.resolve("mermaid"))) as {
      default: {
        initialize: (options: { startOnLoad: boolean; securityLevel: string; theme: string }) => void;
        parse: (source: string, options?: { suppressErrors: boolean }) => Promise<{ diagramType: string } | false>;
      };
    };
    mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: "default" });
    await expect(mermaid.parse("flowchart TD\n  A[Start] --> B[Done]")).resolves.toMatchObject({
      diagramType: expect.stringMatching(/^flowchart/)
    });
    await expect(mermaid.parse("sequenceDiagram\n  Alice->>Bob: Hello")).resolves.toMatchObject({
      diagramType: "sequence"
    });
    const invalid = "flowchart TD\n  A[Start] --> B[";
    await expect(mermaid.parse(invalid)).rejects.toBeDefined();
    await expect(mermaid.parse(invalid, { suppressErrors: true })).resolves.toBe(false);
  });
});
