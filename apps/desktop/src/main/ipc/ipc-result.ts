/**
 * IPC 错误处理
 * 提供类型安全的 Result DTO，统一 IPC 通信的错误处理
 *
 * 注意：使用纯 JSON 的 DTO 格式，而不是 neverthrow 的 Result 类实例，
 * 因为类实例通过 IPC 序列化后会丢失方法。
 */

import type { IpcError, IpcResultDTO } from "@shared";

/**
 * 创建成功结果 DTO
 */
export function ipcOk<T>(data: T): IpcResultDTO<T> {
  return { ok: true, value: data };
}

/**
 * 创建失败结果 DTO
 */
export function ipcErr<T = never>(message: string, code: string, error?: unknown): IpcResultDTO<T> {
  const ipcError: IpcError = {
    message,
    code
  };

  // 开发环境添加堆栈信息
  if (process.env.NODE_ENV === "development" && error instanceof Error) {
    ipcError.stack = error.stack;
  }

  return { ok: false, error: ipcError };
}

/**
 * 包装异步函数，自动处理错误
 * @param fn 异步函数（不包含 event 参数）
 * @param errorCode 默认错误代码
 * @returns 返回符合 IpcMain.handle 签名的函数，返回纯 JSON 的 DTO
 *
 * @example
 * ipcMain.handle("file:read", wrapIpcHandler(
 *   async (filePath: string) => {
 *     return await fs.readFile(filePath, "utf-8");
 *   },
 *   "FILE_READ_FAILED"
 * ));
 */
export function wrapIpcHandler<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  errorCode = "UNKNOWN_ERROR"
): (event: Electron.IpcMainInvokeEvent, ...args: TArgs) => Promise<IpcResultDTO<TResult>> {
  return async (_event: Electron.IpcMainInvokeEvent, ...args: TArgs): Promise<IpcResultDTO<TResult>> => {
    try {
      const result = await fn(...args);
      return ipcOk(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return ipcErr(message, errorCode, error);
    }
  };
}
