import type { Folder, Note } from "@/types";

export interface WorkspaceSearchResult {
  kind: "folder" | "file";
  id: string;
  name: string;
}

const MAX_RESULTS_PER_GROUP = 12;
const LEADING_DOT_SLASH = /^(?:\.\/)+/;
const TRAILING_SLASH = /\/+$/;

interface SearchQuery {
  text: string;
  exactText?: string;
  matchPath: boolean;
  literalPaths: readonly string[];
}

enum MatchRank {
  LiteralPath,
  TrimmedLiteralPath,
  LiteralExact,
  WindowsPath,
  TrimmedWindowsPath,
  WindowsExact,
  LiteralPrefix,
  LiteralSubstring,
  WindowsPrefix,
  WindowsSubstring,
  None
}

function basename(relativePath: string): string {
  return relativePath.slice(relativePath.lastIndexOf("/") + 1);
}

function normalizeSearchText(text: string): string {
  return text.normalize("NFC").toLowerCase();
}

function withDirectoryPath(query: SearchQuery): SearchQuery {
  if (!query.text.endsWith("/")) return query;
  // Descendants still match the full query, including its separator.
  return {
    ...query,
    exactText: query.text.replace(TRAILING_SLASH, ""),
    literalPaths: query.literalPaths.map((path) => path.replace(TRAILING_SLASH, ""))
  };
}

function matchRank(id: string, candidate: string, query: SearchQuery, windows = false): MatchRank {
  const [inputPath, trimmedPath] = query.literalPaths;
  if (id === inputPath) return windows ? MatchRank.WindowsPath : MatchRank.LiteralPath;
  if (id === trimmedPath) return windows ? MatchRank.TrimmedWindowsPath : MatchRank.TrimmedLiteralPath;
  if (!query.text) return MatchRank.None;
  if (candidate === (query.exactText ?? query.text)) return windows ? MatchRank.WindowsExact : MatchRank.LiteralExact;

  const index = candidate.indexOf(query.text);
  if (index < 0) return MatchRank.None;
  if (index === 0) return windows ? MatchRank.WindowsPrefix : MatchRank.LiteralPrefix;
  return windows ? MatchRank.WindowsSubstring : MatchRank.LiteralSubstring;
}

function matchEntries<T extends { id: string }>(
  entries: readonly T[],
  kind: WorkspaceSearchResult["kind"],
  getName: (entry: T) => string,
  literal: SearchQuery,
  windows: SearchQuery | undefined
): { items: WorkspaceSearchResult[]; bestRank: number } {
  const buckets: WorkspaceSearchResult[][] = Array.from({ length: MatchRank.None }, () => []);
  for (const entry of entries) {
    const name = getName(entry);
    const candidate = normalizeSearchText(literal.matchPath ? entry.id : name);
    const literalRank = matchRank(entry.id, candidate, literal);
    let rank = literalRank;
    if (windows && literalRank > MatchRank.LiteralExact) {
      const windowsCandidate = literal.matchPath ? candidate : normalizeSearchText(entry.id);
      rank = Math.min(literalRank, matchRank(entry.id, windowsCandidate, windows, true));
    }
    if (rank === MatchRank.None) continue;

    const bucket = buckets[rank];
    if (bucket.length < MAX_RESULTS_PER_GROUP) bucket.push({ kind, id: entry.id, name });
  }

  const firstMatch = buckets.findIndex((items) => items.length > 0);
  return {
    items: buckets.flat().slice(0, MAX_RESULTS_PER_GROUP),
    bestRank: firstMatch < 0 ? MatchRank.None : firstMatch
  };
}

export function findWorkspaceSearchResults(
  folders: readonly Pick<Folder, "id" | "name">[],
  notes: readonly Pick<Note, "id" | "fileName">[],
  input: string
): { folders: WorkspaceSearchResult[]; files: WorkspaceSearchResult[]; filesFirst?: boolean } {
  const trimmed = input.trim();
  if (!trimmed) return { folders: [], files: [] };

  const matchPath = trimmed.includes("/");
  const hasBackslash = trimmed.includes("\\");
  const trimmedPath = trimmed.replace(LEADING_DOT_SLASH, "");
  const literal: SearchQuery = {
    text: normalizeSearchText(trimmedPath),
    matchPath,
    literalPaths:
      matchPath || hasBackslash ? [input.replace(LEADING_DOT_SLASH, ""), trimmedPath] : input === trimmed ? [] : [input]
  };
  // POSIX names can contain backslashes. Also accept them as Windows path separators.
  const windowsPaths = hasBackslash
    ? [input, trimmed].map((path) => path.replaceAll("\\", "/").replace(LEADING_DOT_SLASH, ""))
    : undefined;
  const windows = windowsPaths
    ? { text: normalizeSearchText(windowsPaths[1]), matchPath: true, literalPaths: windowsPaths }
    : undefined;

  const folderMatches = matchEntries(
    folders,
    "folder",
    (folder) => basename(folder.name),
    withDirectoryPath(literal),
    windows && withDirectoryPath(windows)
  );
  const fileMatches = matchEntries(notes, "file", (note) => note.fileName ?? basename(note.id), literal, windows);
  // Ordinary name searches keep the existing group order. An exact path should be the first keyboard result.
  const exactPathRank = matchPath || hasBackslash ? MatchRank.WindowsExact : MatchRank.LiteralPath;
  const filesFirst =
    folderMatches.bestRank !== MatchRank.None &&
    fileMatches.bestRank < folderMatches.bestRank &&
    fileMatches.bestRank <= exactPathRank;
  return {
    folders: folderMatches.items,
    files: fileMatches.items,
    ...(filesFirst && { filesFirst })
  };
}
