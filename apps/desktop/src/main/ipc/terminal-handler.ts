import { app, ipcMain } from "electron";
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

interface ShellCommand {
  shell: string;
  args: string[];
}

function getPlatformShellCommand(): ShellCommand {
  if (process.platform === "win32") {
    return { shell: process.env.ComSpec || "powershell.exe", args: [] };
  }
  const envShell = (process.env.SHELL || "").trim();
  if (process.platform === "darwin") {
    return { shell: envShell || "/bin/zsh", args: ["-il"] };
  }
  return { shell: envShell || "/bin/bash", args: ["-il"] };
}

function getDefaultUtf8Locale(): string {
  const locale = app.getLocale().trim();
  const normalized = locale.replace("-", "_");
  if (!normalized) return "en_US.UTF-8";
  const parts = normalized.split("_").filter(Boolean);
  const language = parts[0]?.toLowerCase();
  if (!language) return "en_US.UTF-8";
  const region = (parts[1] || language).toUpperCase();
  return `${language}_${region}.UTF-8`;
}

function buildTerminalEnv(): Record<string, string> {
  const env = { ...(process.env as Record<string, string>) };
  const sourceLocale = env.LANG || env.LC_ALL || env.LC_CTYPE;
  const utf8Locale =
    sourceLocale && sourceLocale.toUpperCase() !== "C" && sourceLocale.toUpperCase() !== "POSIX"
      ? sourceLocale
      : getDefaultUtf8Locale();
  env.LANG = env.LANG || utf8Locale;
  env.LC_CTYPE = env.LC_CTYPE || utf8Locale;
  env.LC_MESSAGES = env.LC_MESSAGES || utf8Locale;
  env.LANGUAGE = env.LANGUAGE || utf8Locale.split(".")[0];
  // Match common modern terminal capabilities so TUI apps render consistently.
  env.TERM = env.TERM || "xterm-256color";
  env.COLORTERM = env.COLORTERM || "truecolor";
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
      const { shell, args } = getPlatformShellCommand();
      const pty = spawn(shell, args, {
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
