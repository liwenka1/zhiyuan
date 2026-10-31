import { ipcMain } from "electron";
import { ipcOk, ipcErr } from "./ipc-result";
import type { IpcResultDTO, GitHubIssuePushRequest, GitHubIssuePushResult } from "@shared";
import { createIssue, getContentSha, getRepositoryDefaultBranch, updateIssue, uploadContent } from "../github";
import type { GitHubAssetUploadRequest, GitHubAssetUploadResult } from "@shared";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { getCallerWorkspace } from "../security/window-context";
import { validatePathInWorkspace } from "../security/path-validator";
import { configManager } from "../config";
import { isValidFileNameSegment } from "@shared";

export function registerGitHubHandlers(): void {
  ipcMain.handle(
    "github:pushIssue",
    async (_event, payload: GitHubIssuePushRequest): Promise<IpcResultDTO<GitHubIssuePushResult>> => {
      try {
        if (!payload || typeof payload !== "object") {
          return ipcErr("Invalid payload", "GITHUB_PUSH_INVALID");
        }

        const projectKey = String(payload.projectKey || configManager.getGitHubActiveProjectKey()).trim();
        const projectConfig = configManager.getGitHubProjectConfigs()[projectKey] ?? {
          owner: "",
          repo: "",
          token: ""
        };
        const owner = String(projectConfig.owner || payload.owner || "").trim();
        const repo = String(projectConfig.repo || payload.repo || "").trim();
        const token = String(projectConfig.token || payload.token || "").trim();
        const title = String(payload.title || "").trim();
        const body = String(payload.body || "");

        if (!owner || !repo || !token) {
          return ipcErr("Missing GitHub config", "GITHUB_PUSH_CONFIG_MISSING");
        }

        if (!title) {
          return ipcErr("Missing issue title", "GITHUB_PUSH_TITLE_MISSING");
        }

        if (payload.issueNumber) {
          const issue = await updateIssue({
            owner,
            repo,
            token,
            issueNumber: payload.issueNumber,
            title,
            body
          });
          return ipcOk({
            issueNumber: payload.issueNumber,
            issueUrl: issue.html_url,
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
    async (event, payload: GitHubAssetUploadRequest): Promise<IpcResultDTO<GitHubAssetUploadResult>> => {
      try {
        if (!payload || typeof payload !== "object") {
          return ipcErr("Invalid payload", "GITHUB_UPLOAD_INVALID");
        }

        const projectKey = String(payload.projectKey || configManager.getGitHubActiveProjectKey()).trim();
        const projectConfig = configManager.getGitHubProjectConfigs()[projectKey] ?? {
          owner: "",
          repo: "",
          token: ""
        };
        const owner = String(projectConfig.owner || payload.owner || "").trim();
        const repo = String(projectConfig.repo || payload.repo || "").trim();
        const token = String(projectConfig.token || payload.token || "").trim();
        const noteId = String(payload.noteId || "").trim();
        const localPath = String(payload.localPath || "").trim();
        const assetsFolder = payload.assetsFolder?.trim() || "assets";
        const maxBytes = payload.maxBytes ?? 10 * 1024 * 1024;

        if (!owner || !repo || !token || !noteId || !localPath) {
          return ipcErr("Missing asset upload params", "GITHUB_UPLOAD_PARAMS_MISSING");
        }
        if (!isValidFileNameSegment(assetsFolder)) {
          return ipcErr("Invalid assets folder", "GITHUB_UPLOAD_ASSETS_FOLDER_INVALID");
        }
        const noteSegments = noteId.replaceAll("\\", "/").split("/");
        if (noteSegments.some((segment) => !isValidFileNameSegment(segment))) {
          return ipcErr("Invalid note id", "GITHUB_UPLOAD_NOTE_ID_INVALID");
        }

        const branch = payload.branch?.trim() || (await getRepositoryDefaultBranch({ owner, repo, token }));

        const workspacePath = getCallerWorkspace(event);
        if (!validatePathInWorkspace(workspacePath, localPath).isValid) {
          return ipcErr("Asset path is outside workspace", "GITHUB_UPLOAD_PATH_INVALID");
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

        const encodedAssetPath = assetPath
          .split("/")
          .map((segment) => encodeURIComponent(segment))
          .join("/");
        const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(branch).replace(/%2F/g, "/")}/${encodedAssetPath}`;

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
