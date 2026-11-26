import { JSDOM } from "jsdom";
import { captureClipboardEquations } from "./capture";
import type { ClipboardEquationSource } from "./clipboard-equation-layout";

function equationStyleContext(element: Element): ClipboardEquationSource["context"] {
  const ancestors: ClipboardEquationSource["context"] = [];
  for (let parent: Element | null = element; parent; parent = parent.parentElement) {
    const style = (parent as HTMLElement).style;
    const declarations = Array.from(style ?? [])
      .filter(
        (name) =>
          name === "font" ||
          name === "color" ||
          name === "color-scheme" ||
          name.startsWith("font-") ||
          name.startsWith("--")
      )
      .map((name) => `${name}: ${style.getPropertyValue(name)}${style.getPropertyPriority(name) ? " !important" : ""}`);
    ancestors.push({ tag: parent.localName, style: declarations.join(";") });
  }
  return ancestors.reverse();
}

export async function renderClipboardEquations(
  html: string,
  assertCurrent: () => void,
  signal: AbortSignal
): Promise<string> {
  if (!html.includes("katex-mathml")) return html;
  const document = JSDOM.fragment(html);
  const sources = new Map<string, ClipboardEquationSource>();
  const formulas = [...document.querySelectorAll(".katex")].flatMap((element) => {
    const source = element.querySelector(':scope > .katex-mathml annotation[encoding="application/x-tex"]');
    const visual = element.querySelector(":scope > .katex-html");
    if (!source || !visual) return [];
    const tag = visual.querySelector<HTMLElement>(":scope > .katex-tag, :scope > .tag");
    if (tag) {
      // KaTeX normally positions the tag at the edge of the full-width display.
      // Include it in the natural width of a tightly cropped clipboard image.
      tag.style.position = "static";
      tag.style.display = "inline-block";
      if (element.closest(".katex-display.leqno")) {
        tag.style.marginInlineEnd = "1em";
        visual.prepend(tag);
      } else {
        tag.style.marginInlineStart = "1em";
      }
    }
    const input = { visual: visual.outerHTML, context: equationStyleContext(element) };
    const key = JSON.stringify(input);
    const cached = sources.get(key) ?? input;
    sources.set(key, cached);
    return [{ element, tex: source.textContent ?? "", input: cached }];
  });
  if (!formulas.length) return html;

  const images = await captureClipboardEquations([...sources.values()], assertCurrent, signal);
  for (const { element, tex, input } of formulas) {
    const rendered = images.get(input);
    if (!rendered) {
      const code = element.ownerDocument.createElement("code");
      code.style.whiteSpace = "pre-wrap";
      code.textContent = tex;
      element.replaceWith(code);
      continue;
    }
    const image = element.ownerDocument.createElement("img");
    image.src = rendered.url;
    image.alt = tex;
    image.width = rendered.width;
    image.height = rendered.height;
    image.style.cssText = "display: inline-block; margin: 0; max-width: 100%; height: auto; vertical-align: middle";
    element.replaceWith(image);
  }

  const container = document.ownerDocument.createElement("template");
  container.content.append(document);
  return container.innerHTML;
}
