import { ipcRenderer } from "electron";
import type {
  GitHubIssuePushRequest,
  GitHubIssuePushResult,
  GitHubAssetUploadRequest,
  GitHubAssetUploadResult,
  IpcResultDTO
} from "@shared";

export const githubApi = {
  pushIssue: (payload: GitHubIssuePushRequest): Promise<IpcResultDTO<GitHubIssuePushResult>> =>
    ipcRenderer.invoke("github:pushIssue", payload),
  releasePublication: (publicationId: string): Promise<IpcResultDTO<void>> =>
    ipcRenderer.invoke("github:releasePublication", publicationId),
  uploadAsset: (payload: GitHubAssetUploadRequest): Promise<IpcResultDTO<GitHubAssetUploadResult>> =>
    ipcRenderer.invoke("github:uploadAsset", payload)
};
