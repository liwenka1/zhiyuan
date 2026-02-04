/**
 * 路径安全校验工具
 * 防止路径穿越攻击，确保文件操作在允许的范围内
 */

import path from "path";
import fs from "fs";

/**
 * 规范化路径，解析符号链接和相对路径
 * @param targetPath 目标路径
 * @returns 规范化后的绝对路径，如果路径不存在则返回 resolve 后的路径
 */
function normalizePath(targetPath: string): string {
  try {
    // 尝试解析真实路径（处理符号链接）
    return fs.realpathSync(targetPath);
  } catch {
    // 路径不存在时，使用 resolve 进行规范化
    return path.resolve(targetPath);
  }
}

/**
 * 检查目标路径是否在基准目录内
 * @param basePath 基准目录（如工作区路径）
 * @param targetPath 目标路径
 * @returns 是否在基准目录内
 */
export function isPathInside(basePath: string, targetPath: string): boolean {
  const normalizedBase = normalizePath(basePath);
  const normalizedTarget = normalizePath(targetPath);

  // 确保基准路径以分隔符结尾，防止 /workspace-other 被误判为 /workspace 的子目录
  const baseWithSep = normalizedBase.endsWith(path.sep) ? normalizedBase : normalizedBase + path.sep;

  return normalizedTarget.startsWith(baseWithSep) || normalizedTarget === normalizedBase;
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
}

/**
 * 校验路径是否在工作区内
 * @param workspacePath 工作区路径
 * @param targetPath 目标路径
 * @returns 校验结果
 */
export function validatePathInWorkspace(workspacePath: string, targetPath: string): PathValidationResult {
  const normalizedTarget = normalizePath(targetPath);

  if (isPathInside(workspacePath, targetPath)) {
    return {
      isValid: true,
      normalizedPath: normalizedTarget
    };
  }

  return {
    isValid: false,
    normalizedPath: normalizedTarget,
    reason: `Path "${normalizedTarget}" is outside workspace "${workspacePath}"`
  };
}

/**
 * 校验路径是否在允许的目录列表内
 * @param allowedPaths 允许的目录列表
 * @param targetPath 目标路径
 * @returns 校验结果
 */
export function validatePathInAllowedDirs(allowedPaths: string[], targetPath: string): PathValidationResult {
  const normalizedTarget = normalizePath(targetPath);

  for (const allowedPath of allowedPaths) {
    if (isPathInside(allowedPath, targetPath)) {
      return {
        isValid: true,
        normalizedPath: normalizedTarget
      };
    }
  }

  return {
    isValid: false,
    normalizedPath: normalizedTarget,
    reason: `Path "${normalizedTarget}" is not in any allowed directory`
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
