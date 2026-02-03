/**
 * Theme IPC wrapper
 */

import { unwrapIpcResult } from "@/lib/ipc-utils";
import type { ThemeMode } from "@shared";

export const themeIpc = {
  get: async () => unwrapIpcResult(await window.api.theme.get()),

  set: async (theme: ThemeMode) => unwrapIpcResult(await window.api.theme.set(theme)),

  // 事件监听不需要 unwrap，直接透传
  onChanged: window.api.theme.onChanged
};
