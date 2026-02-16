export interface GitHubAssetUploadRequest {
  owner: string;
  repo: string;
  token: string;
  branch?: string;
  noteId: string;
  localPath: string;
  assetsFolder?: string;
  maxBytes?: number;
}

export interface GitHubAssetUploadResult {
  sha?: string;
  rawUrl?: string;
  skipped?: boolean;
  reason?: "missing" | "too_large";
}
