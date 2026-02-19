import { ipcMain } from "electron";
import { randomUUID } from "node:crypto";
import { spawn, type IPty } from "node-pty";
import { ipcErr, ipcOk } from "./ipc-result";
import type { IpcResultDTO } from "@shared";

interface TerminalSession {
  id: string;
  pty: IPty;
  senderId: number;
}

interface TerminalDataPayload {
  id: string;
  data: string;
}

interface TerminalExitPayload {
  id: string;
  exitCode: number;
  signal?: number;
}

const sessions = new Map<string, TerminalSession>();

function safeSend(
  sender: Electron.WebContents,
  channel: string,
  payload: TerminalDataPayload | TerminalExitPayload
): void {
  if (sender.isDestroyed()) return;
  try {
    sender.send(channel, payload);
  } catch {
    // 窗口销毁阶段可能抛出 Object has been destroyed，直接忽略
  }
}

function getPlatformShell(): string {
  if (process.platform === "win32") {
    return "powershell.exe";
  }
  if (process.platform === "darwin") {
    return "zsh";
  }
  return "bash";
}

function buildTerminalEnv(): Record<string, string> {
  const env = { ...(process.env as Record<string, string>) };
  const utf8Locale = env.LANG || env.LC_ALL || "en_US.UTF-8";
  env.LANG = env.LANG || utf8Locale;
  env.LC_ALL = env.LC_ALL || utf8Locale;
  env.LC_CTYPE = env.LC_CTYPE || utf8Locale;
  return env;
}

function safeDisposeSession(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (!session) return;
  try {
    session.pty.kill();
  } catch {
    // 忽略 kill 异常，确保 session 释放
  }
  sessions.delete(sessionId);
}

function disposeSenderSessions(senderId: number): void {
  const sessionIds = [...sessions.values()]
    .filter((session) => session.senderId === senderId)
    .map((session) => session.id);
  sessionIds.forEach((id) => safeDisposeSession(id));
}

export function registerTerminalHandlers(): void {
  ipcMain.handle("terminal:create", (event, workspacePath?: string): IpcResultDTO<{ id: string }> => {
    try {
      const shell = getPlatformShell();
      const pty = spawn(shell, [], {
        name: "xterm-256color",
        cols: 80,
        rows: 24,
        cwd: workspacePath ?? process.env.HOME ?? process.cwd(),
        env: buildTerminalEnv()
      });

      const id = randomUUID();
      sessions.set(id, { id, pty, senderId: event.sender.id });

      pty.onData((data) => {
        safeSend(event.sender, "terminal:data", { id, data } satisfies TerminalDataPayload);
      });

      pty.onExit(({ exitCode, signal }) => {
        safeSend(event.sender, "terminal:exit", { id, exitCode, signal } satisfies TerminalExitPayload);
        safeDisposeSession(id);
      });

      event.sender.once("destroyed", () => {
        disposeSenderSessions(event.sender.id);
      });

      return ipcOk({ id });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return ipcErr(message, "TERMINAL_CREATE_FAILED", error);
    }
  });

  ipcMain.handle("terminal:input", (_, id: string, data: string): IpcResultDTO<void> => {
    try {
      const session = sessions.get(id);
      if (!session) {
        return ipcErr("Terminal session not found", "TERMINAL_SESSION_NOT_FOUND");
      }
      session.pty.write(data);
      return ipcOk(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return ipcErr(message, "TERMINAL_INPUT_FAILED", error);
    }
  });

  ipcMain.handle("terminal:resize", (_, id: string, cols: number, rows: number): IpcResultDTO<void> => {
    try {
      const session = sessions.get(id);
      if (!session) {
        return ipcErr("Terminal session not found", "TERMINAL_SESSION_NOT_FOUND");
      }
      const safeCols = Math.max(2, Math.floor(cols));
      const safeRows = Math.max(1, Math.floor(rows));
      session.pty.resize(safeCols, safeRows);
      return ipcOk(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return ipcErr(message, "TERMINAL_RESIZE_FAILED", error);
    }
  });

  ipcMain.handle("terminal:dispose", (_, id: string): IpcResultDTO<void> => {
    try {
      safeDisposeSession(id);
      return ipcOk(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return ipcErr(message, "TERMINAL_DISPOSE_FAILED", error);
    }
  });
}
