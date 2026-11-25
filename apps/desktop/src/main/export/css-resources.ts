import { generate, ident, parse, walk, type CssNode, type FunctionNode, type WalkContext } from "css-tree";

type ReplaceUrl = (url: string) => string | null | undefined | Promise<string | null | undefined>;

function isImageSet(node: CssNode | null): node is FunctionNode {
  if (node?.type !== "Function") return false;
  const name = ident.decode(node.name).toLowerCase();
  return name === "image-set" || name === "-webkit-image-set";
}

async function rewriteImageSet(node: FunctionNode, replace: ReplaceUrl): Promise<boolean> {
  const alternatives: CssNode[][] = [[]];
  let alternative = alternatives[0];
  for (const child of node.children) {
    if (child.type === "Operator" && child.value === ",") {
      alternative = [];
      alternatives.push(alternative);
    } else {
      alternative.push(child);
    }
  }

  let changed = false;
  const kept: CssNode[] = [];
  for (const option of alternatives) {
    const image = option[0];
    if ((image?.type === "String" || image?.type === "Url") && image.value) {
      const next = await replace(image.value);
      if (next === null) {
        changed = true;
        continue;
      }
      if (next !== undefined && next !== image.value) {
        image.value = next;
        changed = true;
      }
    }
    if (kept.length) kept.push({ type: "Operator", value: "," });
    kept.push(...option);
  }
  if (changed) node.children.fromArray(kept);
  return changed;
}

export async function rewriteCssResources(
  css: string,
  context: "stylesheet" | "declarationList",
  replace: ReplaceUrl
): Promise<string> {
  let tree: CssNode;
  try {
    tree = parse(css, { context, parseCustomProperty: true });
  } catch {
    return css;
  }

  const rewrites: Array<() => Promise<boolean>> = [];
  walk(tree, {
    leave(this: WalkContext, node, item, list) {
      // A URL in @supports or a selector is a test, not a resource used by the document.
      if (!this.declaration || this.atrulePrelude) return;
      if (isImageSet(node)) {
        rewrites.push(async () => {
          const changed = await rewriteImageSet(node, replace);
          if (changed && node.children.isEmpty)
            list.replace(item, list.createItem({ type: "Identifier", name: "none" }));
          return changed;
        });
      } else if (node.type === "Url" && node.value && !(isImageSet(this.function) && this.function.children === list)) {
        rewrites.push(async () => {
          const next = await replace(node.value);
          if (next === undefined || next === node.value) return false;
          if (next === null) list.replace(item, list.createItem({ type: "Identifier", name: "none" }));
          else node.value = next;
          return true;
        });
      }
    }
  });

  let changed = false;
  for (const rewrite of rewrites) {
    if (await rewrite()) changed = true;
  }
  return changed ? generate(tree) : css;
}
