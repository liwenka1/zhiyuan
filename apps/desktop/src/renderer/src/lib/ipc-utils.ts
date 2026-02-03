/**
 * IPC 工具函数
 * 用于 renderer 侧处理 IPC Result DTO
 */

import { ok, err, type Result } from "neverthrow";
import type { IpcError, IpcResultDTO } from "@shared";

/**
 * IPC Result 类型（neverthrow 的 Result 类型）
 */
export type IpcResult<T> = Result<T, IpcError>;

/**
 * 从 DTO 重建 neverthrow Result 对象
 *
 * 注意：IPC 传输的是纯 JSON 的 DTO，需要在 renderer 层重建为 Result 对象，
 * 这样才能使用 isOk()、isErr()、map() 等方法。
 *
 * @param dto IPC 传输的 DTO
 * @returns neverthrow Result 对象
 */
export function fromIpcResultDTO<T>(dto: IpcResultDTO<T>): IpcResult<T> {
  if (dto.ok) {
    return ok(dto.value);
  }
  return err(dto.error);
}

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
  console.error(`IPC Error [${dto.error.code}]:`, dto.error.message);
  return undefined;
}
