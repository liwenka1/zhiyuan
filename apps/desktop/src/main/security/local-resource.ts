import fs from "node:fs";
import path from "node:path";
import { decodeLocalResourceUrl } from "@shared";
import { validatePathInWorkspace } from "./path-validator";

/** 请求只能使用 URL capability 所属窗口的工作区，授权不依赖全局焦点。 */
export function resolveAuthorizedLocalResource(
  requestUrl: string,
  getWorkspaceForToken: (token: string) => string | null
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
