/**
 * 路径安全校验工具
 * 防止路径穿越攻击，确保文件操作在允许的范围内
 */

import path from "path";
import fs from "fs";

/**
 * 规范化路径，解析符号链接和相对路径
 * @param targetPath 目标路径
 * @returns 规范化后的绝对路径；缺失的路径会解析到最近存在的祖先
 */
function normalizePath(targetPath: string): { normalizedPath: string; blockedByFile: boolean } {
  let existingPath = path.resolve(targetPath);
  const missingParts: string[] = [];
  let blockedByFile = false;
  while (true) {
    try {
      // lstat sees dangling links, which must fail realpath rather than count as new entries.
      fs.lstatSync(existingPath);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOENT" && code !== "ENOTDIR") throw error;
      blockedByFile ||= code === "ENOTDIR";
      const parent = path.dirname(existingPath);
      if (parent === existingPath) throw error;
      missingParts.unshift(path.basename(existingPath));
      existingPath = parent;
      continue;
    }
    const realPath = fs.realpathSync.native(existingPath);
    return {
      normalizedPath: path.join(realPath, ...missingParts),
      blockedByFile: blockedByFile || (missingParts.length > 0 && !fs.statSync(realPath).isDirectory())
    };
  }
}

function isAbsoluteFilePath(value: unknown): value is string {
  return typeof value === "string" && !value.includes("\0") && path.isAbsolute(value);
}

function isNormalizedPathInside(basePath: string, targetPath: string): boolean {
  const prefix = basePath.endsWith(path.sep) ? basePath : `${basePath}${path.sep}`;
  return targetPath === basePath || targetPath.startsWith(prefix);
}

/**
 * 检查目标路径是否在基准目录内
 * @param basePath 基准目录（如工作区路径）
 * @param targetPath 目标路径
 * @returns 是否在基准目录内
 */
export function isPathInside(basePath: string, targetPath: string): boolean {
  return validatePathInWorkspace(basePath, targetPath).isValid;
}

/**
 * 路径校验结果
 */
export interface PathValidationResult {
  /** 是否在允许范围内 */
  isValid: boolean;
  /** 规范化后的路径 */
  normalizedPath: string;
  /** 如果不合法，说明原因 */
  reason?: string;
  code?: "ENOTDIR";
}

/**
 * 校验路径是否在工作区内
 * @param workspacePath 工作区路径
 * @param targetPath 目标路径
 * @returns 校验结果
 */
export function validatePathInWorkspace(workspacePath: string, targetPath: string): PathValidationResult {
  if (!isAbsoluteFilePath(workspacePath) || !isAbsoluteFilePath(targetPath)) {
    return {
      isValid: false,
      normalizedPath: "",
      reason: "Invalid path"
    };
  }

  try {
    const normalizedBase = fs.realpathSync.native(path.resolve(workspacePath));
    if (!fs.statSync(normalizedBase).isDirectory()) throw new Error("Invalid workspace directory");
    const { normalizedPath, blockedByFile } = normalizePath(targetPath);
    if (isNormalizedPathInside(normalizedBase, normalizedPath)) {
      if (blockedByFile) {
        return { isValid: false, normalizedPath, reason: "Parent path is not a directory", code: "ENOTDIR" };
      }
      return { isValid: true, normalizedPath };
    }
    return {
      isValid: false,
      normalizedPath,
      reason: `Path "${normalizedPath}" is outside workspace "${workspacePath}"`
    };
  } catch {
    return { isValid: false, normalizedPath: "", reason: "Cannot resolve path" };
  }
}

/**
 * 校验路径是否在允许的目录列表内
 * @param allowedPaths 允许的目录列表
 * @param targetPath 目标路径
 * @returns 校验结果
 */
export function validatePathInAllowedDirs(allowedPaths: string[], targetPath: string): PathValidationResult {
  for (const allowedPath of allowedPaths) {
    const validation = validatePathInWorkspace(allowedPath, targetPath);
    if (validation.isValid) return validation;
  }

  return {
    isValid: false,
    normalizedPath: "",
    reason: "Path is not in any allowed directory"
  };
}

/**
 * 检查路径是否包含路径穿越尝试（如 ../）
 * 注意：这只是初步检查，实际校验应使用 isPathInside
 * @param targetPath 目标路径
 * @returns 是否包含可疑的路径穿越模式
 */
export function hasPathTraversalPattern(targetPath: string): boolean {
  // 检查常见的路径穿越模式
  const patterns = [
    /\.\.[/\\]/, // ../
    /[/\\]\.\.$/, // 以 /.. 结尾
    /%2e%2e[/\\]/i, // URL 编码的 ../
    /%252e%252e/i // 双重 URL 编码
  ];

  return patterns.some((pattern) => pattern.test(targetPath));
}
