/**
 * IPC 相关的共享类型定义
 * 供主进程、渲染进程和 preload 使用
 */

/**
 * IPC 错误信息
 */
export interface IpcError {
  /** 错误消息 */
  message: string;
  /** 错误代码（用于程序化处理） */
  code: string;
  /** 原始错误堆栈（仅开发环境） */
  stack?: string;
}

/**
 * IPC Result DTO（用于 IPC 传输的纯 JSON 格式）
 *
 * 注意：neverthrow 的 Result 是类实例，通过 IPC 序列化后会丢失方法。
 * 因此我们使用这个纯 JSON 的 DTO 格式进行传输，在 renderer 层重建 Result 对象。
 */
export type IpcResultDTO<T> = { ok: true; value: T } | { ok: false; error: IpcError };
