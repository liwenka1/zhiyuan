import { handleAppIpc } from "../security/app-ipc";
import { ipcOk, ipcErr } from "./ipc-result";
import type { IpcResultDTO, GitHubIssuePushRequest, GitHubIssuePushResult } from "@shared";
import { createIssue, getContentSha, getRepositoryDefaultBranch, updateIssue, uploadContent } from "../github";
import type { GitHubAssetUploadRequest, GitHubAssetUploadResult } from "@shared";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { getCallerWorkspaceScope } from "../security/window-context";
import { validatePathInWorkspace } from "../security/path-validator";
import { configManager } from "../config";
import { isValidFileNameSegment } from "@shared";
import { publicationLeases as publications, type PublicationLeases } from "../github/publication-leases";

function resolveSelectedGitHubProject(payload: { projectKey?: string; owner: string; repo: string }) {
  const projectKey = String(payload.projectKey || configManager.getGitHubActiveProjectKey()).trim();
  const project = configManager.getGitHubProjectConfigs()[projectKey];
  if (!project?.owner || !project.repo || !project.token) {
    throw new Error("Missing GitHub config");
  }
  const owner = project.owner.trim();
  const repo = project.repo.trim();
  // The renderer chose its issue and assets using this repository snapshot.
  // Never silently redirect that request after another window edits the project.
  if (
    String(payload.owner || "")
      .trim()
      .toLowerCase() !== owner.toLowerCase() ||
    String(payload.repo || "")
      .trim()
      .toLowerCase() !== repo.toLowerCase()
  ) {
    throw new Error("GitHub project changed. Reload the project settings before publishing.");
  }
  return { owner, repo, token: project.token.trim() };
}

export function registerGitHubHandlers(): void {
  handleAppIpc(
    "github:pushIssue",
    async (event, payload: GitHubIssuePushRequest): Promise<IpcResultDTO<GitHubIssuePushResult>> => {
      let lease: ReturnType<PublicationLeases["acquire"]> | undefined;
      try {
        if (!payload || typeof payload !== "object") {
          return ipcErr("Invalid payload", "GITHUB_PUSH_INVALID");
        }

        const { owner, repo, token } = resolveSelectedGitHubProject(payload);
        const title = String(payload.title || "").trim();
        const body = String(payload.body || "");

        if (!owner || !repo || !token) {
          return ipcErr("Missing GitHub config", "GITHUB_PUSH_CONFIG_MISSING");
        }

        if (!title) {
          return ipcErr("Missing issue title", "GITHUB_PUSH_TITLE_MISSING");
        }

        if (typeof payload.sourcePath !== "string" || !path.isAbsolute(payload.sourcePath)) {
          return ipcErr("Missing source file path", "GITHUB_PUSH_SOURCE_INVALID");
        }
        const validation = validatePathInWorkspace(getCallerWorkspaceScope(event), payload.sourcePath);
        const sourcePath = validation.normalizedPath;
        if (!validation.isValid || !(await fs.stat(sourcePath)).isFile()) {
          return ipcErr("Source file is outside workspace", "GITHUB_PUSH_SOURCE_INVALID");
        }
        lease = publications.acquire(sourcePath, owner, repo, event.sender);
        // Other windows may still display an older association. The actual file (or
        // an uncommitted successful create) determines whether this is an update.
        const issueNumber = publications.issueNumber(lease, await fs.readFile(sourcePath, "utf8"));
        if (issueNumber) {
          const issue = await updateIssue({
            owner,
            repo,
            token,
            issueNumber,
            title,
            body
          });
          const result = {
            issueNumber,
            issueUrl: issue.html_url,
            isNew: false,
            publicationId: lease.id
          };
          publications.remoteSucceeded(lease, result);
          return ipcOk(result);
        }

        const issue = await createIssue({ owner, repo, token, title, body });
        const result = {
          issueNumber: issue.number,
          issueUrl: issue.html_url,
          isNew: true,
          publicationId: lease.id
        };
        publications.remoteSucceeded(lease, result);
        return ipcOk(result);
      } catch (error) {
        if (lease) publications.remoteFailed(lease);
        const message = error instanceof Error ? error.message : String(error);
        return ipcErr(message, "GITHUB_PUSH_FAILED", error);
      }
    }
  );

  handleAppIpc("github:releasePublication", async (event, publicationId: string): Promise<IpcResultDTO<void>> => {
    try {
      const lease = publications.owned(String(publicationId), event.sender);
      if (lease) {
        const content = await fs.readFile(lease.sourcePath, "utf8").catch(() => undefined);
        publications.release(lease, content);
      }
      return ipcOk(undefined);
    } catch (error) {
      return ipcErr(error instanceof Error ? error.message : String(error), "GITHUB_PUBLICATION_RELEASE_FAILED", error);
    }
  });

  handleAppIpc(
    "github:uploadAsset",
    async (event, payload: GitHubAssetUploadRequest): Promise<IpcResultDTO<GitHubAssetUploadResult>> => {
      try {
        if (!payload || typeof payload !== "object") {
          return ipcErr("Invalid payload", "GITHUB_UPLOAD_INVALID");
        }

        const { owner, repo, token } = resolveSelectedGitHubProject(payload);
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

        const validation = validatePathInWorkspace(getCallerWorkspaceScope(event), localPath);
        if (!validation.isValid) {
          return ipcErr("Asset path is outside workspace", "GITHUB_UPLOAD_PATH_INVALID");
        }

        const stat = await fs.stat(validation.normalizedPath).catch(() => null);
        if (!stat?.isFile()) {
          return ipcOk({ skipped: true, reason: "missing" });
        }
        if (stat.size > maxBytes) {
          return ipcOk({ skipped: true, reason: "too_large" });
        }

        const buffer = await fs.readFile(validation.normalizedPath);
        const branch = payload.branch?.trim() || (await getRepositoryDefaultBranch({ owner, repo, token }));
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
