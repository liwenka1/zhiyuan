import fs from "node:fs";
import path from "node:path";
import { decodeLocalResourceUrl } from "@shared";
import { validatePathInWorkspace, type WorkspacePathScope } from "./path-validator";
import { getLocalMediaType, resolveLocalRegularFile } from "./local-file";

/** 请求只能使用 URL capability 所属窗口的工作区，授权不依赖全局焦点。 */
export function resolveAuthorizedLocalResource(
  requestUrl: string,
  getWorkspaceForToken: (token: string) => string | WorkspacePathScope | null
): string | null {
  try {
    const url = new URL(requestUrl);
    const token = url.searchParams.get("__window");
    if (url.protocol !== "local-resource:" || !token) return null;
    const workspacePath = getWorkspaceForToken(token);
    if (!workspacePath) return null;
    const filePath = decodeLocalResourceUrl(requestUrl);
    if (!path.isAbsolute(filePath)) return null;
    const validation = validatePathInWorkspace(workspacePath, filePath);
    if (!validation.isValid || !fs.statSync(validation.normalizedPath).isFile()) return null;
    return validation.normalizedPath;
  } catch {
    return null;
  }
}

export function resolveLocalMediaPreview(
  requestUrl: string,
  getWorkspaceForToken: (token: string) => string | WorkspacePathScope | null
): { filePath: string; mimeType?: string } | null {
  try {
    const url = new URL(requestUrl);
    const token = url.searchParams.get("__window");
    if (url.protocol !== "local-media:" || !token || !getWorkspaceForToken(token)) return null;
    const reference = requestUrl.replace(/^local-media:/, "local-resource:");
    const workspaceFile = resolveAuthorizedLocalResource(reference, getWorkspaceForToken);
    if (workspaceFile) return { filePath: workspaceFile };

    const filePath = resolveLocalRegularFile(decodeLocalResourceUrl(reference));
    const mimeType = filePath && getLocalMediaType(filePath);
    return filePath && mimeType ? { filePath, mimeType } : null;
  } catch {
    return null;
  }
}
