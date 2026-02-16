import { ipcMain } from "electron";
import { ipcOk, ipcErr } from "./ipc-result";
import type { IpcResultDTO, GitHubIssuePushRequest, GitHubIssuePushResult } from "@shared";
import { createIssue, createIssueComment, getContentSha, uploadContent } from "../github";
import type { GitHubAssetUploadRequest, GitHubAssetUploadResult } from "@shared";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

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

  ipcMain.handle(
    "github:uploadAsset",
    async (_event, payload: GitHubAssetUploadRequest): Promise<IpcResultDTO<GitHubAssetUploadResult>> => {
      try {
        if (!payload || typeof payload !== "object") {
          return ipcErr("Invalid payload", "GITHUB_UPLOAD_INVALID");
        }

        const owner = String(payload.owner || "").trim();
        const repo = String(payload.repo || "").trim();
        const token = String(payload.token || "").trim();
        const noteId = String(payload.noteId || "").trim();
        const localPath = String(payload.localPath || "").trim();
        const branch = payload.branch?.trim() || undefined;
        const assetsFolder = payload.assetsFolder?.trim() || "assets";
        const maxBytes = payload.maxBytes ?? 10 * 1024 * 1024;

        if (!owner || !repo || !token || !noteId || !localPath) {
          return ipcErr("Missing asset upload params", "GITHUB_UPLOAD_PARAMS_MISSING");
        }

        const stat = await fs.stat(localPath).catch(() => null);
        if (!stat) {
          return ipcOk({ skipped: true, reason: "missing" });
        }
        if (stat.size > maxBytes) {
          return ipcOk({ skipped: true, reason: "too_large" });
        }

        const buffer = await fs.readFile(localPath);
        const hash = crypto.createHash("sha256").update(buffer).digest("hex");
        const ext = path.extname(localPath);
        const assetPath = `${assetsFolder}/${noteId}/${hash}${ext}`;
        const contentBase64 = buffer.toString("base64");

        const existingSha = await getContentSha({ owner, repo, token, path: assetPath, ref: branch });
        const message = `upload asset: ${assetPath}`;
        const result = await uploadContent({
          owner,
          repo,
          token,
          path: assetPath,
          contentBase64,
          message,
          branch,
          sha: existingSha || undefined
        });

        const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch || "main"}/${assetPath}`;

        return ipcOk({
          sha: result?.content?.sha,
          rawUrl,
          skipped: false
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return ipcErr(message, "GITHUB_UPLOAD_FAILED", error);
      }
    }
  );
}
