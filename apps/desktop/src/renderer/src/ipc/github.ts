/**
 * GitHub IPC wrapper
 */

import { unwrapIpcResult } from "@/lib/ipc-utils";
import type { GitHubIssuePushRequest, GitHubIssuePushResult } from "@shared";

export const githubIpc = {
  pushIssue: async (payload: GitHubIssuePushRequest): Promise<GitHubIssuePushResult> =>
    unwrapIpcResult(await window.api.github.pushIssue(payload))
};
