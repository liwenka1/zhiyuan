import fs, { type FileHandle } from "node:fs/promises";
import { constants, createWriteStream, type BigIntStats } from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { authorizeLocalResourceUrl, createUrlTransformer, decodeLocalResourceUrl, localResourceUrl } from "@shared";
import { getLocalMediaType, resolveLocalRegularFile } from "../security/local-file";
import { validatePathInWorkspace, type WorkspacePathScope } from "../security/path-validator";
import {
  isLocalExportReference,
  rewriteExportAssets,
  type ExportAssetTarget,
  type ExportAssetType
} from "./asset-markup";
import { downloadExportImage } from "./remote-images";

interface LocalAsset {
  filePath: string;
  search: string;
  hash: string;
  mimeType: string;
  outsideWorkspace: boolean;
  identity: BigIntStats;
}

export interface MissingExportAsset {
  name: string;
  reason: "local" | "unreadable" | "http" | "download" | "decode";
}

export interface ExportAssets {
  workspace?: string | WorkspacePathScope;
  local: ReadonlyMap<string, LocalAsset>;
  remote: ReadonlyMap<string, string>;
  externalFiles: string[];
  missing: MissingExportAsset[];
}

function assetKey(source: string, type: ExportAssetType): string {
  return `${type}:${source}`;
}

function isLocalAssetSource(source: string, type: ExportAssetType): boolean {
  // KaTeX's generated stylesheet bundles its own font references.
  return isLocalExportReference(source) && !(type === "css" && /^fonts\/KaTeX_[\w-]+\.(woff2?|ttf)$/.test(source));
}

function locateLocalAsset(
  source: string,
  type: ExportAssetType,
  notePath?: string,
  workspace?: string | WorkspacePathScope
): Omit<LocalAsset, "identity"> | null {
  if (!notePath || !workspace) return null;
  try {
    const sourceUrl =
      type === "css" && !source.startsWith("local-resource:") ? new URL(source, pathToFileURL(notePath)).href : source;
    const reference = /^file:/i.test(sourceUrl)
      ? sourceUrl
      : createUrlTransformer(notePath, { syntax: "html" })(sourceUrl);
    const url = new URL(reference);
    const requested =
      url.protocol === "local-resource:"
        ? decodeLocalResourceUrl(reference)
        : url.protocol === "file:"
          ? fileURLToPath(url)
          : null;
    if (!requested) return null;
    const validation = validatePathInWorkspace(workspace, requested);
    const outsideWorkspace = !validation.isValid;
    const filePath = resolveLocalRegularFile(
      outsideWorkspace ? requested : validation.normalizedPath,
      !outsideWorkspace
    );
    if (!filePath) return null;
    if (!outsideWorkspace && filePath !== validation.normalizedPath) return null;
    const mimeType = getLocalMediaType(filePath);
    if (outsideWorkspace && (!mimeType || (type !== "media" && !mimeType.startsWith("image/")))) return null;
    url.searchParams.delete("__window");
    return {
      filePath,
      search: url.search,
      hash: url.hash,
      mimeType: mimeType ?? "application/octet-stream",
      outsideWorkspace
    };
  } catch {
    return null;
  }
}

const assetOpenFlags = constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0);

function matchesAssetIdentity(current: BigIntStats, expected: BigIntStats): boolean {
  return (
    current.isFile() &&
    current.dev === expected.dev &&
    current.ino === expected.ino &&
    current.size === expected.size &&
    current.mtimeNs === expected.mtimeNs &&
    current.ctimeNs === expected.ctimeNs
  );
}

async function inspectAssetIdentity(asset: Omit<LocalAsset, "identity">): Promise<BigIntStats | null> {
  const { filePath, outsideWorkspace } = asset;
  try {
    const expected = await fs.lstat(filePath, { bigint: true });
    if (!expected.isFile()) return null;
    const file = await fs.open(filePath, assetOpenFlags);
    try {
      const identity = await file.stat({ bigint: true });
      return matchesAssetIdentity(identity, expected) &&
        resolveLocalRegularFile(filePath, !outsideWorkspace) === filePath
        ? identity
        : null;
    } finally {
      await file.close();
    }
  } catch {
    return null;
  }
}

function remoteImageUrl(source: string): URL | null {
  try {
    const url = new URL(source);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

export async function inspectExportAssets(
  documents: string[],
  notePath: string | undefined,
  workspace: string | WorkspacePathScope | undefined,
  target: ExportAssetTarget,
  validateImages?: (images: string[]) => Promise<boolean[]>
): Promise<ExportAssets> {
  const local = new Map<string, LocalAsset>();
  const fileIdentities = new Map<string, BigIntStats | null>();
  const missing = new Map<string, MissingExportAsset>();
  const downloadUrls = new Map<string, URL>();
  const inspected = new Set<string>();

  for (const html of documents) {
    await rewriteExportAssets(
      html,
      target,
      async (source, type) => {
        const key = assetKey(source, type);
        if (inspected.has(key)) return;
        inspected.add(key);
        if (isLocalAssetSource(source, type)) {
          const asset = locateLocalAsset(source, type, notePath, workspace);
          if (!asset) {
            let name = source;
            try {
              name = decodeLocalResourceUrl(source);
            } catch {
              name = source.split("?", 1)[0];
            }
            missing.set(source, { name, reason: "local" });
            return;
          }
          let identity = fileIdentities.get(asset.filePath);
          if (identity === undefined) {
            identity = await inspectAssetIdentity(asset);
            fileIdentities.set(asset.filePath, identity);
          }
          if (!identity || (asset.outsideWorkspace && identity.ino === 0n)) {
            missing.set(source, { name: asset.filePath, reason: "unreadable" });
            return;
          }
          local.set(key, { ...asset, identity });
          return;
        }
        if (target !== "capture" || !validateImages) return;
        const url = remoteImageUrl(source);
        if (!url) return;
        if (url.protocol === "http:") missing.set(source, { name: url.host + url.pathname, reason: "http" });
        else if (url.username || url.password)
          missing.set(source, { name: url.host + url.pathname, reason: "download" });
        else {
          url.hash = "";
          downloadUrls.set(url.href, url);
        }
      },
      { workspace }
    );
  }

  const remote = new Map<string, string>();
  const urls = [...downloadUrls.values()];
  const signal = AbortSignal.timeout(15_000);
  let remaining = 48 * 1024 * 1024;
  for (let index = 0; index < urls.length; index += 4) {
    const batch = urls.slice(index, index + 4);
    const images = await Promise.all(
      batch.map((url) => (remaining > 0 && !signal.aborted ? downloadExportImage(url.href, signal) : null))
    );
    for (const [index, url] of batch.entries()) {
      const data = images[index];
      if (data && data.length <= remaining) {
        remaining -= data.length;
        remote.set(url.href, data);
      } else {
        missing.set(url.href, { name: url.host + url.pathname, reason: "download" });
      }
    }
  }

  if (target === "capture" && validateImages) {
    const localImages = new Map<string, string>();
    for (const [key, asset] of local) {
      if (key.startsWith("image:") || asset.mimeType.startsWith("image/")) {
        localImages.set(asset.filePath, pathToFileURL(asset.filePath).href);
      }
    }
    const sources = [...localImages.values(), ...remote.values()];
    const valid = sources.length ? await validateImages(sources) : [];
    let index = 0;
    const badFiles = new Set<string>();
    for (const filename of localImages.keys()) {
      if (!valid[index++]) {
        badFiles.add(filename);
        missing.set(filename, { name: filename, reason: "decode" });
      }
    }
    for (const [key, asset] of local) {
      if (badFiles.has(asset.filePath)) local.delete(key);
    }
    for (const href of remote.keys()) {
      if (!valid[index++]) {
        remote.delete(href);
        const url = new URL(href);
        missing.set(href, { name: url.host + url.pathname, reason: "decode" });
      }
    }
  }

  const externalFiles = new Set(
    [...local.values()].filter((asset) => asset.outsideWorkspace).map((asset) => asset.filePath)
  );
  return { workspace, local, remote, externalFiles: [...externalFiles], missing: [...missing.values()] };
}

function selectedAsset(
  assets: ExportAssets,
  source: string,
  type: ExportAssetType,
  includeExternal: boolean
): LocalAsset | undefined {
  const asset = assets.local.get(assetKey(source, type));
  return asset && (!asset.outsideWorkspace || includeExternal) ? asset : undefined;
}

async function readReviewedAsset<T>(asset: LocalAsset, read: (file: FileHandle) => Promise<T>): Promise<T> {
  const changed = () => new Error(`Export asset changed: ${path.basename(asset.filePath)}`);
  if (resolveLocalRegularFile(asset.filePath, !asset.outsideWorkspace) !== asset.filePath) {
    throw changed();
  }
  const file = await fs.open(asset.filePath, assetOpenFlags);
  try {
    if (!matchesAssetIdentity(await file.stat({ bigint: true }), asset.identity)) throw changed();
    const value = await read(file);
    if (!matchesAssetIdentity(await file.stat({ bigint: true }), asset.identity)) throw changed();
    return value;
  } finally {
    await file.close();
  }
}

export async function renderHtmlExportPreview(
  html: string,
  assets: ExportAssets,
  missingLabel: string,
  resourceToken: string
): Promise<string> {
  return rewriteExportAssets(
    html,
    "html",
    (source, type) => {
      if (!isLocalAssetSource(source, type)) return undefined;
      const asset = selectedAsset(assets, source, type, false);
      return asset
        ? authorizeLocalResourceUrl(localResourceUrl(asset.filePath) + asset.search + asset.hash, resourceToken)
        : null;
    },
    { workspace: assets.workspace, missingLabel }
  );
}

export async function embedExportImages(
  html: string,
  assets: ExportAssets,
  includeExternal = false,
  missingLabel?: string
): Promise<string> {
  const embedded = new Map<string, string>();
  return rewriteExportAssets(
    html,
    "capture",
    async (source, type) => {
      if (isLocalAssetSource(source, type)) {
        const asset = selectedAsset(assets, source, type, includeExternal);
        if (!asset || (type === "css" && !asset.mimeType.startsWith("image/"))) return null;
        let data = embedded.get(asset.filePath);
        if (!data) {
          const buffer = await readReviewedAsset(asset, (file) => file.readFile());
          data = `data:${asset.mimeType};base64,${buffer.toString("base64")}`;
          embedded.set(asset.filePath, data);
        }
        return data + asset.hash;
      }
      const url = remoteImageUrl(source);
      if (!url) return undefined;
      const hash = url.hash;
      url.hash = "";
      const data = assets.remote.get(url.href);
      return data ? data + hash : null;
    },
    { workspace: assets.workspace, missingLabel }
  );
}

/** Build an offline image document from workspace resources. */
export async function embedLocalImages(
  html: string,
  notePath?: string,
  workspace?: string | WorkspacePathScope
): Promise<string> {
  const assets = await inspectExportAssets([html], notePath, workspace, "capture");
  return embedExportImages(html, assets);
}

export async function collectAndCopyAssets(
  html: string,
  notePath: string | undefined,
  assetsDir: string,
  assetsFolderName: string,
  workspace?: string | WorkspacePathScope,
  reviewed?: { assets: ExportAssets; includeExternal: boolean; missingLabel: string }
): Promise<{ processedHtml: string; copiedFiles: string[] }> {
  const assets = reviewed?.assets ?? (await inspectExportAssets([html], notePath, workspace, "html"));
  const copiedFiles: string[] = [];
  const copiedFileNames = new Set<string>();
  const copies = new Map<string, string>();

  const processedHtml = await rewriteExportAssets(
    html,
    "html",
    async (source, type) => {
      if (!isLocalAssetSource(source, type)) return undefined;
      const asset = selectedAsset(assets, source, type, reviewed?.includeExternal ?? false);
      if (!asset) return null;
      let packagedUrl = copies.get(asset.filePath);
      if (!packagedUrl) {
        const ext = path.extname(asset.filePath);
        const basename = path.basename(asset.filePath, ext);
        let fileName = basename + ext;
        let counter = 1;
        while (copiedFileNames.has(fileName.normalize("NFC").toLowerCase())) {
          fileName = `${basename}-${counter++}${ext}`;
        }
        copiedFileNames.add(fileName.normalize("NFC").toLowerCase());

        const destination = path.join(assetsDir, fileName);
        await readReviewedAsset(asset, (file) =>
          pipeline(
            file.createReadStream({ autoClose: false }),
            createWriteStream(destination, { flags: "wx", mode: Number(asset.identity.mode & 0o777n) })
          )
        );
        copiedFiles.push(destination);
        packagedUrl = `./${encodeURIComponent(assetsFolderName).replaceAll("'", "%27")}/${encodeURIComponent(fileName).replaceAll("'", "%27")}`;
        copies.set(asset.filePath, packagedUrl);
      }
      return packagedUrl + asset.search + asset.hash;
    },
    { workspace: assets.workspace, missingLabel: reviewed?.missingLabel }
  );
  return { processedHtml, copiedFiles };
}
