import fs, { type FileHandle } from "node:fs/promises";
import { constants, createWriteStream, type BigIntStats } from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { authorizeLocalResourceUrl, createUrlTransformer, decodeLocalResourceUrl, localResourceUrl } from "@shared";
import { getLocalMediaType, isExternalNoteFile, resolveLocalRegularFile } from "../security/local-file";
import { validatePathInWorkspace, type WorkspacePathScope } from "../security/path-validator";
import {
  isDataUrl,
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
  reason: "local" | "unreadable" | "http" | "download" | "decode" | "size";
}

export interface ExportAssets {
  workspace?: string | WorkspacePathScope;
  local: ReadonlyMap<string, LocalAsset>;
  remote: ReadonlyMap<string, string>;
  inline: ReadonlySet<string>;
  externalFiles: string[];
  missing: MissingExportAsset[];
}

const EMBEDDED_ASSET_LIMIT = 48 * 1024 * 1024;

function assetKey(source: string, type: ExportAssetType): string {
  return `${type}:${source}`;
}

function isLocalAssetSource(source: string, type: ExportAssetType): boolean {
  // KaTeX's generated stylesheet bundles its own font references.
  return isLocalExportReference(source) && !(type === "css" && /^fonts\/KaTeX_[\w-]+\.(woff2?|ttf)$/.test(source));
}

function hasHiddenPathComponent(filePath: string, workspace: string | WorkspacePathScope): boolean {
  const roots = typeof workspace === "string" ? [workspace] : [workspace.workspacePath, workspace.scannedWorkspacePath];
  const relative = roots
    .filter((root): root is string => !!root)
    .map((root) => path.relative(root, filePath))
    .find((candidate) => !path.isAbsolute(candidate) && candidate !== ".." && !candidate.startsWith(`..${path.sep}`));
  return (relative ?? path.normalize(filePath))
    .split(path.sep)
    .some((segment) => segment.startsWith(".") && segment !== "." && segment !== "..");
}

function locateLocalAsset(
  source: string,
  type: ExportAssetType,
  target: ExportAssetTarget,
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
    if (type === "attachment" && !isExternalNoteFile(filePath)) return null;
    if (target === "clipboard") {
      if (type === "media" && !/^(audio|video)\//.test(mimeType ?? "")) return null;
      if (type === "css" && !mimeType?.startsWith("image/")) return null;
      if (
        !outsideWorkspace &&
        (type === "attachment" || type === "media") &&
        [requested, filePath].some((candidate) => hasHiddenPathComponent(candidate, workspace))
      )
        return null;
    }
    if (
      outsideWorkspace &&
      type !== "attachment" &&
      (!mimeType || (type !== "media" && !mimeType.startsWith("image/")))
    )
      return null;
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

function clipboardLocalBytes(asset: LocalAsset, copies: number): bigint {
  // Each occurrence writes its own data URL and base64 expands the original file.
  return (4n * ((asset.identity.size + 2n) / 3n) + 128n) * BigInt(copies);
}

type ValidateImages = (images: string[], signal?: AbortSignal) => Promise<boolean[]>;
type ImageCheck = { source: string; omit: () => void };
type RemoteImageReference = { url: URL; copies: number };

function localImageChecks(
  local: Map<string, LocalAsset>,
  missing: Map<string, MissingExportAsset>,
  outsideWorkspace?: boolean
): ImageCheck[] {
  const references = new Map<string, string[]>();
  for (const [key, asset] of local) {
    if (outsideWorkspace !== undefined && outsideWorkspace !== asset.outsideWorkspace) continue;
    if (!key.startsWith("image:") && !(key.startsWith("css:") && asset.mimeType.startsWith("image/"))) continue;
    const keys = references.get(asset.filePath);
    if (keys) keys.push(key);
    else references.set(asset.filePath, [key]);
  }
  return Array.from(references, ([filename, keys]) => ({
    source: pathToFileURL(filename).href,
    omit() {
      missing.set(filename, { name: filename, reason: "decode" });
      for (const key of keys) local.delete(key);
    }
  }));
}

async function checkImages(checks: ImageCheck[], validate: ValidateImages): Promise<void> {
  if (!checks.length) return;
  const valid = await validate(checks.map(({ source }) => source));
  for (const [index, check] of checks.entries()) {
    if (!valid[index]) check.omit();
  }
}

function omitOversizedClipboardFiles(
  local: Map<string, LocalAsset>,
  missing: Map<string, MissingExportAsset>,
  references: Map<string, number>,
  available: bigint,
  outsideWorkspace: boolean
): void {
  for (const [key, asset] of local) {
    if (
      asset.outsideWorkspace !== outsideWorkspace ||
      clipboardLocalBytes(asset, references.get(key) ?? 1) <= available
    )
      continue;
    local.delete(key);
    missing.set(asset.filePath, { name: asset.filePath, reason: "size" });
  }
}

function reserveClipboardFiles(
  local: Map<string, LocalAsset>,
  missing: Map<string, MissingExportAsset>,
  references: Map<string, number>,
  remaining: bigint,
  outsideWorkspace: boolean
): bigint {
  for (const [key, asset] of local) {
    if (asset.outsideWorkspace !== outsideWorkspace) continue;
    const bytes = clipboardLocalBytes(asset, references.get(key) ?? 1);
    if (bytes <= remaining) remaining -= bytes;
    else {
      local.delete(key);
      missing.set(asset.filePath, { name: asset.filePath, reason: "size" });
    }
  }
  return remaining;
}

function omitRemoteImage(missing: Map<string, MissingExportAsset>, url: URL, reason: MissingExportAsset["reason"]) {
  missing.set(url.href, { name: url.host + url.pathname, reason });
}

async function inspectRemoteImages(
  urls: RemoteImageReference[],
  missing: Map<string, MissingExportAsset>,
  remaining: number,
  clipboardDecoder?: ValidateImages,
  signal?: AbortSignal
) {
  const remote = new Map<string, string>();
  if (!urls.length) return { remote, remaining };
  let downloadTimeLeft = 15_000;
  // Clipboard review may decode a batch before downloading the rest.
  const reviewDeadline = AbortSignal.timeout(clipboardDecoder ? 23_000 : downloadTimeLeft);
  const reviewSignal = signal ? AbortSignal.any([signal, reviewDeadline]) : reviewDeadline;
  const pending: Array<{ url: URL; data: string; bytes: number }> = [];
  let pendingBytes = 0;

  async function acceptDecodedImages(validate: ValidateImages) {
    if (!pending.length) return;
    const results = await validate(pending.map(({ data }) => data));
    for (const [index, { url, data, bytes }] of pending.entries()) {
      if (results[index]) {
        remote.set(url.href, data);
        remaining -= bytes;
      } else omitRemoteImage(missing, url, "decode");
    }
    pending.length = 0;
    pendingBytes = 0;
  }

  for (let offset = 0; offset < urls.length; offset += 4) {
    const batch = urls.slice(offset, offset + 4);
    const downloadStart = performance.now();
    const downloadSignal =
      clipboardDecoder && downloadTimeLeft > 0
        ? AbortSignal.any([reviewSignal, AbortSignal.timeout(Math.ceil(downloadTimeLeft))])
        : reviewSignal;
    const images = await Promise.all(
      batch.map(({ url }) =>
        remaining > 0 && downloadTimeLeft > 0 && !downloadSignal.aborted
          ? downloadExportImage(url.href, downloadSignal)
          : null
      )
    );
    signal?.throwIfAborted();
    downloadTimeLeft -= performance.now() - downloadStart;
    for (const [index, { url, copies }] of batch.entries()) {
      const data = images[index];
      if (!data) {
        omitRemoteImage(missing, url, clipboardDecoder && remaining === 0 ? "size" : "download");
        continue;
      }
      const bytes = data.length * copies;
      if (clipboardDecoder && bytes <= remaining && bytes + pendingBytes > remaining) {
        // Clear undecodable images before deciding whether a later image can fit.
        await acceptDecodedImages(clipboardDecoder);
      }
      if (bytes > remaining) {
        omitRemoteImage(missing, url, clipboardDecoder ? "size" : "download");
      } else if (clipboardDecoder) {
        pending.push({ url, data, bytes });
        pendingBytes += bytes;
      } else {
        remote.set(url.href, data);
        remaining -= bytes;
      }
    }
  }
  if (clipboardDecoder) await acceptDecodedImages(clipboardDecoder);
  return { remote, remaining };
}

export async function inspectExportAssets(
  documents: string[],
  notePath: string | undefined,
  workspace: string | WorkspacePathScope | undefined,
  target: ExportAssetTarget,
  validateImages?: ValidateImages,
  signal?: AbortSignal
): Promise<ExportAssets> {
  signal?.throwIfAborted();
  const validate = validateImages && signal ? (images: string[]) => validateImages(images, signal) : validateImages;
  const local = new Map<string, LocalAsset>();
  const fileIdentities = new Map<string, BigIntStats | null>();
  const missing = new Map<string, MissingExportAsset>();
  const downloadUrls = new Map<string, RemoteImageReference>();
  const inspected = new Set<string>();
  const clipboardReferences = target === "clipboard" ? new Map<string, number>() : null;
  const inlineBytes = new Map<string, bigint>();

  for (const html of documents) {
    await rewriteExportAssets(
      html,
      target,
      async (source, type) => {
        signal?.throwIfAborted();
        if (clipboardReferences && isDataUrl(source)) {
          inlineBytes.set(source, (inlineBytes.get(source) ?? 0n) + BigInt(Buffer.byteLength(source)));
          return;
        }
        const key = assetKey(source, type);
        if (isLocalAssetSource(source, type)) {
          if (clipboardReferences) clipboardReferences.set(key, (clipboardReferences.get(key) ?? 0) + 1);
          if (inspected.has(key)) return;
          inspected.add(key);
          const asset = locateLocalAsset(source, type, target, notePath, workspace);
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
        if (target === "html" || !validateImages || type === "media" || type === "attachment") return;
        const url = remoteImageUrl(source);
        if (!url) return;
        if (url.protocol === "http:") missing.set(source, { name: url.host + url.pathname, reason: "http" });
        else if (url.username || url.password)
          missing.set(source, { name: url.host + url.pathname, reason: "download" });
        else {
          url.hash = "";
          const copies = clipboardReferences ? (downloadUrls.get(url.href)?.copies ?? 0) + 1 : 1;
          downloadUrls.set(url.href, { url, copies });
        }
      },
      { workspace }
    );
  }

  let clipboardSpace = BigInt(EMBEDDED_ASSET_LIMIT);
  const inline = new Set<string>();
  if (clipboardReferences) {
    for (const [source, bytes] of inlineBytes) {
      if (bytes <= clipboardSpace) {
        clipboardSpace -= bytes;
        inline.add(source);
      } else {
        const mime = /^data:([\w.+-]{1,64}\/[\w.+-]{1,64})[;,]/i.exec(source)?.[1];
        missing.set(source, { name: mime ? `data:${mime}` : "data:", reason: "size" });
      }
    }
    omitOversizedClipboardFiles(local, missing, clipboardReferences, clipboardSpace, false);
    if (validate) await checkImages(localImageChecks(local, missing, false), validate);
    clipboardSpace = reserveClipboardFiles(local, missing, clipboardReferences, clipboardSpace, false);
  }
  const { remote, remaining } = await inspectRemoteImages(
    [...downloadUrls.values()],
    missing,
    Number(clipboardSpace),
    clipboardReferences ? validate : undefined,
    signal
  );
  if (clipboardReferences) {
    const externalSpace = BigInt(remaining);
    omitOversizedClipboardFiles(local, missing, clipboardReferences, externalSpace, true);
    if (validate) await checkImages(localImageChecks(local, missing, true), validate);
    // Optional external files use only the space left by the default resources.
    reserveClipboardFiles(local, missing, clipboardReferences, externalSpace, true);
  } else if (target === "capture" && validate) {
    const images = localImageChecks(local, missing);
    for (const [href, source] of remote) {
      images.push({
        source,
        omit() {
          remote.delete(href);
          omitRemoteImage(missing, new URL(href), "decode");
        }
      });
    }
    await checkImages(images, validate);
  }

  const externalFiles = new Set(
    [...local.values()].filter((asset) => asset.outsideWorkspace).map((asset) => asset.filePath)
  );
  signal?.throwIfAborted();
  return { workspace, local, remote, inline, externalFiles: [...externalFiles], missing: [...missing.values()] };
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

async function readReviewedAsset<T>(
  asset: LocalAsset,
  read: (file: FileHandle) => Promise<T>,
  signal?: AbortSignal
): Promise<T> {
  signal?.throwIfAborted();
  const changed = () => new Error(`Export asset changed: ${path.basename(asset.filePath)}`);
  if (resolveLocalRegularFile(asset.filePath, !asset.outsideWorkspace) !== asset.filePath) {
    throw changed();
  }
  let file: FileHandle | undefined;
  try {
    file = await fs.open(asset.filePath, assetOpenFlags);
    signal?.throwIfAborted();
    if (!matchesAssetIdentity(await file.stat({ bigint: true }), asset.identity)) throw changed();
    signal?.throwIfAborted();
    const value = await read(file);
    signal?.throwIfAborted();
    if (!matchesAssetIdentity(await file.stat({ bigint: true }), asset.identity)) throw changed();
    return value;
  } catch (error) {
    signal?.throwIfAborted();
    throw error;
  } finally {
    await file?.close();
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

export async function embedExportAssets(
  html: string,
  assets: ExportAssets,
  includeExternal = false,
  missingLabel?: string,
  target: "capture" | "clipboard" = "capture",
  signal?: AbortSignal
): Promise<string> {
  signal?.throwIfAborted();
  const embedded = new Map<string, string>();
  const result = await rewriteExportAssets(
    html,
    target,
    async (source, type) => {
      signal?.throwIfAborted();
      if (target === "clipboard" && isDataUrl(source)) return assets.inline.has(source) ? undefined : null;
      if (isLocalAssetSource(source, type)) {
        const asset = selectedAsset(assets, source, type, includeExternal);
        if (!asset || (type === "css" && !asset.mimeType.startsWith("image/"))) return null;
        let data = embedded.get(asset.filePath);
        if (!data) {
          const buffer = await readReviewedAsset(asset, (file) => file.readFile({ signal }), signal);
          signal?.throwIfAborted();
          data = `data:${asset.mimeType};base64,${buffer.toString("base64")}`;
          embedded.set(asset.filePath, data);
        }
        return type === "attachment" ? { url: data, download: path.basename(asset.filePath) } : data + asset.hash;
      }
      if (type === "media" || type === "attachment") return undefined;
      const url = remoteImageUrl(source);
      if (!url) return undefined;
      const hash = url.hash;
      url.hash = "";
      const data = assets.remote.get(url.href);
      return data ? data + hash : null;
    },
    { workspace: assets.workspace, missingLabel }
  );
  signal?.throwIfAborted();
  return result;
}

/** Build an offline image document from workspace resources. */
export async function embedLocalImages(
  html: string,
  notePath?: string,
  workspace?: string | WorkspacePathScope
): Promise<string> {
  const assets = await inspectExportAssets([html], notePath, workspace, "capture");
  return embedExportAssets(html, assets);
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
