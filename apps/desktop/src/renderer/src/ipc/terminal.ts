import { unwrapIpcResult } from "@/lib/ipc-utils";

export const terminalIpc = {
  create: async (workspacePath?: string) => unwrapIpcResult(await window.api.terminal.create(workspacePath)),
  write: async (id: string, data: string) => unwrapIpcResult(await window.api.terminal.write(id, data)),
  resize: async (id: string, cols: number, rows: number) =>
    unwrapIpcResult(await window.api.terminal.resize(id, cols, rows)),
  dispose: async (id: string) => unwrapIpcResult(await window.api.terminal.dispose(id)),
  onData: window.api.terminal.onData,
  onExit: window.api.terminal.onExit
};
