/**
 * IPC 工具函数
 * 用于 renderer 侧处理 IPC Result DTO
 */

import type { IpcResultDTO } from "@shared";

/**
 * 解包 IPC Result DTO，自动处理错误
 * @param dto IPC Result DTO
 * @returns 数据（如果成功）
 * @throws 错误（如果失败）
 *
 * @example
 * const theme = unwrapIpcResult(await window.api.theme.get());
 */
export function unwrapIpcResult<T>(dto: IpcResultDTO<T>): T {
  if (dto.ok) {
    return dto.value;
  }
  throw new Error(dto.error.message);
}

/**
 * 安全解包 IPC Result DTO，返回 undefined 而不是抛出错误
 * @param dto IPC Result DTO
 * @returns 数据（如果成功）或 undefined（如果失败）
 *
 * @example
 * const theme = safeUnwrapIpcResult(await window.api.theme.get());
 * if (theme) { ... }
 */
export function safeUnwrapIpcResult<T>(dto: IpcResultDTO<T>): T | undefined {
  if (dto.ok) {
    return dto.value;
  }
  return undefined;
}
