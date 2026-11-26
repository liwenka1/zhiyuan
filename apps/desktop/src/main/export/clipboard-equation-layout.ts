export interface ClipboardEquationSource {
  visual: string;
  context: { tag: string; style: string }[];
}

/** Runs inside the offline Chromium window. Keep this function self-contained for executeJavaScript. */
export async function layoutClipboardEquations(sources: ClipboardEquationSource[]): Promise<Electron.Rectangle[]> {
  const probes = sources.map(({ context }) => {
    const probe = document.createElement("div");
    probe.style.visibility = "hidden";
    let parent: HTMLElement = probe;
    for (const { tag, style } of context) {
      const element = document.createElement(tag);
      element.style.cssText = style;
      parent.append(element);
      parent = element;
    }
    parent.className = "katex";
    return { probe, math: parent };
  });
  document.body.replaceChildren(...probes.map(({ probe }) => probe));
  const rows = sources.map(({ visual }, index) => {
    const { fontSize, color } = getComputedStyle(probes[index].math);
    const math = document.createElement("span");
    math.className = "katex";
    math.style.fontSize = fontSize;
    math.style.color = color;
    math.innerHTML = visual;
    const row = document.createElement("div");
    row.style.cssText = "display: table; width: max-content; padding: 2px; white-space: nowrap";
    row.append(math);
    return row;
  });
  document.body.replaceChildren(...rows);
  window.scrollTo(0, 0);
  await document.fonts.ready;

  type Edges = Pick<DOMRect, "left" | "top" | "right" | "bottom">;
  const range = document.createRange();
  const bounds = rows.map((row) => {
    const original = row.getBoundingClientRect();
    let { left, top, right, bottom } = original;
    function include(rect: Edges, clip: Edges) {
      const x = Math.max(rect.left, clip.left);
      const y = Math.max(rect.top, clip.top);
      const endX = Math.min(rect.right, clip.right);
      const endY = Math.min(rect.bottom, clip.bottom);
      if (endX <= x || endY <= y) return;
      left = Math.min(left, x - 2);
      top = Math.min(top, y - 2);
      right = Math.max(right, endX + 2);
      bottom = Math.max(bottom, endY + 2);
    }
    function measure(element: Element, clip: Edges) {
      const style = getComputedStyle(element);
      if (style.display === "none" || style.opacity === "0" || element.localName === "defs") return;
      const box = element.getBoundingClientRect();
      const visible = style.visibility === "visible";
      const drawsBox =
        element instanceof SVGElement ||
        style.backgroundColor !== "rgba(0, 0, 0, 0)" ||
        style.backgroundImage !== "none" ||
        [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth].some(
          (width) => parseFloat(width) > 0
        );
      if (visible && drawsBox) include(box, clip);

      // KaTeX uses clipped SVGs and zero-width overlays. Keep painted overflow, respecting clipped edges.
      const childClip = {
        left: style.overflowX === "visible" ? clip.left : Math.max(clip.left, box.left),
        right: style.overflowX === "visible" ? clip.right : Math.min(clip.right, box.right),
        top: style.overflowY === "visible" ? clip.top : Math.max(clip.top, box.top),
        bottom: style.overflowY === "visible" ? clip.bottom : Math.min(clip.bottom, box.bottom)
      };
      for (const child of element.childNodes) {
        if (child instanceof Element) measure(child, childClip);
        else if (visible && child.nodeType === Node.TEXT_NODE && child.textContent?.trim()) {
          range.selectNodeContents(child);
          include(range.getBoundingClientRect(), childClip);
        }
      }
    }
    measure(row, { left: -Infinity, top: -Infinity, right: Infinity, bottom: Infinity });
    const x = Math.floor(left - original.left);
    const y = Math.floor(top - original.top);
    return {
      x,
      y,
      width: Math.ceil(right - original.left) - x,
      height: Math.ceil(bottom - original.top) - y
    };
  });

  // Give each row its own paint area so different equations cannot overlap during capture.
  const cells = rows.map((row, index) => {
    const { x, y, width, height } = bounds[index];
    const cell = document.createElement("div");
    cell.style.cssText = `position: relative; width: ${width}px; height: ${height}px; overflow: hidden`;
    row.style.position = "absolute";
    row.style.left = `${-x}px`;
    row.style.top = `${-y}px`;
    cell.append(row);
    return cell;
  });
  document.body.replaceChildren(...cells);
  return cells.map((cell) => {
    const { x, y, width, height } = cell.getBoundingClientRect();
    return { x, y, width, height };
  });
}
