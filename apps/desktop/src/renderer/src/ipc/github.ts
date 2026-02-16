/**
 * GitHub IPC wrapper
 */

import { unwrapIpcResult } from "@/lib/ipc-utils";
import type {
  GitHubIssuePushRequest,
  GitHubIssuePushResult,
  GitHubAssetUploadRequest,
  GitHubAssetUploadResult
} from "@shared";

export const githubIpc = {
  pushIssue: async (payload: GitHubIssuePushRequest): Promise<GitHubIssuePushResult> =>
    unwrapIpcResult(await window.api.github.pushIssue(payload)),
  uploadAsset: async (payload: GitHubAssetUploadRequest): Promise<GitHubAssetUploadResult> =>
    unwrapIpcResult(await window.api.github.uploadAsset(payload))
};
