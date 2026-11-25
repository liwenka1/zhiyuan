import type { Image, Link, Root } from "mdast";
import { decodeString } from "micromark-util-decode-string";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import { unified, type Processor } from "unified";
import { visit } from "unist-util-visit";
import {
  createUrlTransformer,
  decodeResourcePath,
  isLocalAbsolutePath,
  isRelativePath,
  isWorkspaceUncPath,
  localResourceUrl,
  splitResourceReference
} from "@shared/resource-path";

export const markdownParser = unified().use(remarkParse).use(remarkGfm).use(remarkMath).freeze();

interface DestinationRange {
  start: number;
  end: number;
}

interface PathEdit extends DestinationRange {
  replacement: string;
}

interface ParsedDestination extends DestinationRange {
  linkEnd: number;
  url: string;
}

const destinationRanges = new WeakMap<Image | Link, DestinationRange>();

const destinationParser = markdownParser()
  .use(function (this: Processor) {
    this.data("fromMarkdownExtensions", [
      ...(this.data("fromMarkdownExtensions") ?? []),
      {
        exit: {
          resourceDestination(token) {
            const node = this.stack.at(-1);
            if (node?.type === "link" || node?.type === "image") {
              destinationRanges.set(node, { start: token.start.offset, end: token.end.offset });
            }
          }
        }
      }
    ]);
  })
  .freeze();

function findInlineDestinationEnd(
  markdown: string,
  start: number,
  nativeWindowsPath: boolean
): { pathEnd: number; linkEnd: number } | null {
  // A backslash before a parenthesis can be a directory separator in a pasted Windows path.
  const delimiters = nativeWindowsPath ? /[()]|[ \t\r\n]+/g : /\\[\\()]|[()]|[ \t\r\n]+/g;
  const closeLink = /(?:(?:"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|\((?:\\[\s\S]|[^()\\])*\))[ \t\r\n]*)?\)/y;
  const quotedPath = /("[^"\r\n]+"|'[^'\r\n]+')(?=[ \t\r\n)])[ \t\r\n]*/y;
  quotedPath.lastIndex = start;
  const quoted = quotedPath.exec(markdown);
  if (quoted) {
    closeLink.lastIndex = quotedPath.lastIndex;
    if (closeLink.test(markdown)) return { pathEnd: start + quoted[1].length, linkEnd: closeLink.lastIndex };
  }

  delimiters.lastIndex = start;
  let depth = 0;

  for (let token = delimiters.exec(markdown); token; token = delimiters.exec(markdown)) {
    const [delimiter] = token;
    if (delimiter === "(") {
      depth += 1;
    } else if (delimiter === ")") {
      if (depth === 0) return { pathEnd: token.index, linkEnd: delimiters.lastIndex };
      depth -= 1;
    } else if (/^[ \t\r\n]/.test(delimiter)) {
      if (depth === 0) {
        closeLink.lastIndex = delimiters.lastIndex;
        if (closeLink.test(markdown)) return { pathEnd: token.index, linkEnd: closeLink.lastIndex };
      }
      if (/[\r\n]/.test(delimiter)) return null;
    }
  }
  return null;
}

function encodeDestinationPath(pathname: string): string {
  return encodeURI(pathname)
    .replaceAll("#", "%23")
    .replaceAll("?", "%3F")
    .replaceAll("(", "%28")
    .replaceAll(")", "%29");
}

function normalizeInlineDestination(url: string, nativeWindowsPath: boolean, workspacePath?: string | null): string {
  // Legacy quoted destinations contain native filenames, including literal URL delimiters.
  const quoted = url.match(/^(["'])(.*)\1$/)?.[2].trim();
  if (quoted !== undefined) {
    if (isRelativePath(quoted)) {
      return encodeDestinationPath(quoted.replaceAll("\\", "/")).replaceAll("&", "%26").replaceAll("'", "%27");
    }
    const resource = createUrlTransformer(undefined, { workspacePath })(quoted);
    if (!resource.startsWith("local-resource://")) return url;
    // Older local-resource URLs can contain unescaped spaces or parentheses.
    return `<${resource.replaceAll("\\", "%5C").replaceAll("<", "%3C").replaceAll(">", "%3E")}>`;
  }

  const absolute = isLocalAbsolutePath(url);
  if (absolute || url.startsWith("//")) {
    // Decode Markdown references before the native path becomes an opaque URL segment.
    const filePath = decodeString(nativeWindowsPath ? url.replaceAll("\\", "/") : url);
    if (absolute || isWorkspaceUncPath(filePath, workspacePath)) return localResourceUrl(filePath);
    return url;
  }

  if (isRelativePath(url) && /\s/.test(url)) {
    const { pathname, suffix } = splitResourceReference(url);
    const unescaped = pathname.replace(/\\\\|\\([()])/g, (escape, parenthesis?: string) => parenthesis ?? escape);
    return encodeDestinationPath(decodeResourcePath(unescaped.replaceAll("\\", "/"))) + suffix;
  }
  return url;
}

function scanPathEdits(
  markdown: string,
  workspacePath: string | null | undefined,
  canRewrite: (labelEnd: number, destination: DestinationRange) => boolean
): PathEdit[] {
  const edits: PathEdit[] = [];
  const tails = /\\[\s\S]|\]\([ \t\r\n]*([A-Za-z]:\\|\\\\)?/g;

  for (let tail = tails.exec(markdown); tail; tail = tails.exec(markdown)) {
    if (tail[0][0] === "\\") continue;
    const windowsPrefix = tail[1];
    const start = tails.lastIndex - (windowsPrefix?.length ?? 0);
    if (markdown[start] === "<") continue;

    const link = findInlineDestinationEnd(markdown, start, !!windowsPrefix);
    if (!link) continue;
    const url = markdown.slice(start, link.pathEnd).trimEnd();
    const replacement = normalizeInlineDestination(url, !!windowsPrefix, workspacePath);
    const destination = { start, end: start + url.length };
    if (replacement === url || !canRewrite(tail.index, destination)) continue;
    edits.push({ ...destination, replacement });
    tails.lastIndex = link.linkEnd;
  }
  return edits;
}

function readDestinations(tree: Root): ParsedDestination[] {
  const links: ParsedDestination[] = [];
  visit(tree, ["link", "image"] as const, (node) => {
    const range = destinationRanges.get(node);
    const linkEnd = node.position?.end.offset;
    if (range && linkEnd !== undefined) links.push({ ...range, linkEnd, url: node.url });
  });
  return links.sort((first, second) => first.start - second.start);
}

function literalRanges(tree: Root) {
  const ranges: Array<DestinationRange & { inline: boolean }> = [];
  visit(tree, ["code", "inlineCode", "html", "math", "inlineMath"] as const, (node) => {
    const start = node.position?.start.offset;
    const end = node.position?.end.offset;
    if (start !== undefined && end !== undefined) {
      ranges.push({ start, end, inline: node.type !== "code" && node.type !== "math" });
    }
  });
  return ranges;
}

function normalizedOffsets(edits: PathEdit[]) {
  let shift = 0;
  return edits.map((edit) => {
    const normalizedStart = edit.start + shift;
    const normalizedEnd = normalizedStart + edit.replacement.length;
    shift = normalizedEnd - edit.end;
    return { ...edit, normalizedStart, normalizedEnd };
  });
}

function repairMarkdownPaths(markdown: string, workspacePath?: string | null) {
  let original: { links: ParsedDestination[]; literals: ReturnType<typeof literalRanges> } | undefined;

  // A literal wholly inside a bare filename can disappear once that filename is encoded.
  // Reject surrounding code and titles before a candidate can advance the scan past another link.
  let eligible = scanPathEdits(markdown, workspacePath, (labelEnd, { start, end }) => {
    if (!original) {
      const tree = destinationParser.parse(markdown);
      original = { links: readDestinations(tree), literals: literalRanges(tree) };
    }
    return (
      !original.links.some((link) => link.start <= labelEnd && labelEnd < link.linkEnd) &&
      !original.literals.some(
        (range) =>
          (range.start <= labelEnd && labelEnd < range.end) ||
          (range.start < end && start < range.end && (!range.inline || range.start < start || range.end > end))
      )
    );
  });
  while (eligible.length) {
    const offsets = normalizedOffsets(eligible);
    const normalized = rewriteMarkdownDestinations(markdown, eligible, (edit) => edit.replacement);
    const links = readDestinations(destinationParser.parse(normalized));
    const destinations = new Map(links.map(({ start, end }) => [start, end]));
    const confirmed = offsets.filter((edit) => destinations.get(edit.normalizedStart) === edit.normalizedEnd);
    if (confirmed.length === eligible.length) return { markdown: normalized, links, edits: offsets };
    eligible = confirmed;
  }
  return { markdown, links: original?.links, edits: [] };
}

export function getInlineMarkdownDestinations(markdown: string, workspacePath?: string | null) {
  if (!markdown.includes("](")) return [];
  const { links = readDestinations(destinationParser.parse(markdown)), edits } = repairMarkdownPaths(
    markdown,
    workspacePath
  );
  let shift = 0;
  let nextEdit = 0;

  return links.map(({ start, end, url }) => {
    // Nested labels can contain other links. Only destination offsets participate in the rewrite.
    while (nextEdit < edits.length && edits[nextEdit].normalizedEnd <= start) {
      const edit = edits[nextEdit++];
      shift = edit.normalizedEnd - edit.end;
    }
    const sourceStart = start - shift;
    const edit = edits[nextEdit];
    const sourceEnd = edit?.normalizedStart === start ? edit.end : end - shift;
    return { start: sourceStart, end: sourceEnd, originalUrl: markdown.slice(sourceStart, sourceEnd), url };
  });
}

export function rewriteMarkdownDestinations<T extends DestinationRange>(
  markdown: string,
  destinations: readonly T[],
  replace: (destination: T) => string | undefined
): string {
  let normalized = "";
  let copiedThrough = 0;
  for (const destination of destinations) {
    const replacement = replace(destination);
    if (replacement === undefined) continue;
    normalized += markdown.slice(copiedThrough, destination.start) + replacement;
    copiedThrough = destination.end;
  }
  return normalized + markdown.slice(copiedThrough);
}

export function normalizeMarkdownPaths(markdown: string, workspacePath?: string | null): string {
  if (!markdown.includes("](")) return markdown;
  return repairMarkdownPaths(markdown, workspacePath).markdown;
}
