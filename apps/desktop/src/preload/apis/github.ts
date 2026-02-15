import { ipcRenderer } from "electron";
import type { GitHubIssuePushRequest, GitHubIssuePushResult, IpcResultDTO } from "@shared";

export const githubApi = {
  pushIssue: (payload: GitHubIssuePushRequest): Promise<IpcResultDTO<GitHubIssuePushResult>> =>
    ipcRenderer.invoke("github:pushIssue", payload)
};
