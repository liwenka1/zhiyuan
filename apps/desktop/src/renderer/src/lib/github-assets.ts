import type { MarkdownAsset } from "@/lib/markdown-assets";
import { githubIpc } from "@/ipc";

const ASSETS_FOLDER = "assets";
const MAX_ASSET_BYTES = 10 * 1024 * 1024;

export interface UploadAssetsResult {
  replacements: Map<string, string>;
  skipped: MarkdownAsset[];
  uploaded: MarkdownAsset[];
}

export async function uploadMarkdownAssets(params: {
  assets: MarkdownAsset[];
  owner: string;
  repo: string;
  token: string;
  noteId: string;
  branch?: string;
  maxBytes?: number;
}): Promise<UploadAssetsResult> {
  const replacements = new Map<string, string>();
  const skipped: MarkdownAsset[] = [];
  const uploaded: MarkdownAsset[] = [];
  const uploadedByPath = new Map<string, string>();

  const maxBytes = params.maxBytes ?? MAX_ASSET_BYTES;

  for (const asset of params.assets) {
    try {
      const cached = uploadedByPath.get(asset.localPath);
      if (cached) {
        replacements.set(asset.originalUrl, cached);
        uploaded.push(asset);
        continue;
      }

      const result = await githubIpc.uploadAsset({
        owner: params.owner,
        repo: params.repo,
        token: params.token,
        branch: params.branch,
        noteId: params.noteId,
        localPath: asset.localPath,
        assetsFolder: ASSETS_FOLDER,
        maxBytes
      });

      if (result.skipped || !result.rawUrl) {
        skipped.push(asset);
        continue;
      }

      replacements.set(asset.originalUrl, result.rawUrl);
      uploadedByPath.set(asset.localPath, result.rawUrl);
      uploaded.push(asset);
    } catch {
      skipped.push(asset);
    }
  }

  return { replacements, skipped, uploaded };
}
