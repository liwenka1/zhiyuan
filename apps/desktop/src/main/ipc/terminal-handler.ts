import { app } from "electron";
import { handleAppIpc } from "../security/app-ipc";
import { spawn, type IDisposable, type IPty } from "node-pty";
import { ipcErr, ipcOk } from "./ipc-result";
import type { IpcResultDTO } from "@shared";
import { getCallerWorkspace } from "../security/window-context";

interface TerminalSession {
  pty: IPty;
  subscriptions: IDisposable[];
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

interface SenderSessions {
  sessions: Map<string, TerminalSession>;
  detachListeners: () => void;
}

const sessionsBySender = new Map<Electron.WebContents, SenderSessions>();

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

function disposeSession(sender: Electron.WebContents, id: string, kill: boolean): void {
  const owner = sessionsBySender.get(sender);
  const session = owner?.sessions.get(id);
  if (!owner || !session) return;
  owner.sessions.delete(id);
  if (owner.sessions.size === 0) {
    sessionsBySender.delete(sender);
    owner.detachListeners();
  }
  session.subscriptions.forEach((subscription) => subscription.dispose());
  if (!kill) return;
  try {
    session.pty.kill();
  } catch {
    // Shell may already have exited.
  }
}

function getSenderSessions(sender: Electron.WebContents): Map<string, TerminalSession> {
  const owner = sessionsBySender.get(sender);
  if (owner) return owner.sessions;
  const sessions = new Map<string, TerminalSession>();
  const dispose = () => {
    for (const id of sessions.keys()) disposeSession(sender, id, true);
  };
  const detachListeners = () => {
    sender.removeListener("destroyed", dispose);
    sender.removeListener("render-process-gone", dispose);
    sender.removeListener("did-navigate", dispose);
  };
  sessionsBySender.set(sender, { sessions, detachListeners });
  sender.on("destroyed", dispose);
  sender.on("render-process-gone", dispose);
  sender.on("did-navigate", dispose);
  return sessions;
}

export function registerTerminalHandlers(): void {
  handleAppIpc("terminal:create", (event, id: string): IpcResultDTO<void> => {
    const { sender } = event;
    if (typeof id !== "string" || !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(id)) {
      return ipcErr("Invalid terminal session ID", "TERMINAL_CREATE_FAILED");
    }
    if (sessionsBySender.get(sender)?.sessions.has(id)) {
      return ipcErr("Terminal session already exists", "TERMINAL_CREATE_FAILED");
    }
    try {
      const { shell, args } = getPlatformShellCommand();
      const workspacePath = getCallerWorkspace(event);
      const pty = spawn(shell, args, {
        name: "xterm-256color",
        cols: 80,
        rows: 24,
        cwd: workspacePath,
        env: buildTerminalEnv()
      });

      const terminal: TerminalSession = { pty, subscriptions: [] };
      getSenderSessions(sender).set(id, terminal);

      terminal.subscriptions.push(
        pty.onData((data) => {
          safeSend(sender, "terminal:data", { id, data } satisfies TerminalDataPayload);
        })
      );
      terminal.subscriptions.push(
        pty.onExit(({ exitCode, signal }) => {
          disposeSession(sender, id, false);
          safeSend(sender, "terminal:exit", { id, exitCode, signal } satisfies TerminalExitPayload);
        })
      );

      return ipcOk(undefined);
    } catch (error) {
      disposeSession(sender, id, true);
      const message = error instanceof Error ? error.message : String(error);
      return ipcErr(message, "TERMINAL_CREATE_FAILED", error);
    }
  });

  handleAppIpc("terminal:input", (event, id: string, data: string): IpcResultDTO<void> => {
    try {
      const session = sessionsBySender.get(event.sender)?.sessions.get(id);
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

  handleAppIpc("terminal:resize", (event, id: string, cols: number, rows: number): IpcResultDTO<void> => {
    try {
      const session = sessionsBySender.get(event.sender)?.sessions.get(id);
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

  handleAppIpc("terminal:dispose", (event, id: string): IpcResultDTO<void> => {
    try {
      disposeSession(event.sender, id, true);
      return ipcOk(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return ipcErr(message, "TERMINAL_DISPOSE_FAILED", error);
    }
  });
}
