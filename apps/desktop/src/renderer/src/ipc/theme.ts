/**
 * Theme IPC wrapper
 */

import { unwrapIpcResult } from "@/lib/ipc-utils";
import type { ThemeMode } from "@shared";

export const themeIpc = {
  /** 获取当前实际生效的主题（light / dark） */
  get: async () => unwrapIpcResult(await window.api.theme.get()),

  /** 获取用户设置的主题模式（light / dark / system） */
  getMode: async () => unwrapIpcResult(await window.api.theme.getMode()),

  /** 设置主题模式 */
  set: async (theme: ThemeMode) => unwrapIpcResult(await window.api.theme.set(theme)),

  /** 监听主题变化（系统主题或用户设置变化） */
  onChanged: window.api.theme.onChanged
};
