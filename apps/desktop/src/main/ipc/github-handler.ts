import { ipcMain } from "electron";
import { ipcOk, ipcErr } from "./ipc-result";
import type { IpcResultDTO, GitHubIssuePushRequest, GitHubIssuePushResult } from "@shared";
import { createIssue, createIssueComment } from "../github";

export function registerGitHubHandlers(): void {
  ipcMain.handle(
    "github:pushIssue",
    async (_event, payload: GitHubIssuePushRequest): Promise<IpcResultDTO<GitHubIssuePushResult>> => {
      try {
        if (!payload || typeof payload !== "object") {
          return ipcErr("Invalid payload", "GITHUB_PUSH_INVALID");
        }

        const owner = String(payload.owner || "").trim();
        const repo = String(payload.repo || "").trim();
        const token = String(payload.token || "").trim();
        const title = String(payload.title || "").trim();
        const body = String(payload.body || "");

        if (!owner || !repo || !token) {
          return ipcErr("Missing GitHub config", "GITHUB_PUSH_CONFIG_MISSING");
        }

        if (!title) {
          return ipcErr("Missing issue title", "GITHUB_PUSH_TITLE_MISSING");
        }

        if (payload.issueNumber) {
          await createIssueComment({
            owner,
            repo,
            token,
            issueNumber: payload.issueNumber,
            body
          });
          const issueUrl = `https://github.com/${owner}/${repo}/issues/${payload.issueNumber}`;
          return ipcOk({
            issueNumber: payload.issueNumber,
            issueUrl,
            isNew: false
          });
        }

        const issue = await createIssue({ owner, repo, token, title, body });
        return ipcOk({
          issueNumber: issue.number,
          issueUrl: issue.html_url,
          isNew: true
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return ipcErr(message, "GITHUB_PUSH_FAILED", error);
      }
    }
  );
}
