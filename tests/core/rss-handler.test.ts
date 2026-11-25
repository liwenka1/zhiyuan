import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IpcResultDTO } from "@shared";
import { RENDERER_URL, trustedIpcEvent } from "./helpers/trusted-ipc-event";

const { handlers, updateRss, unsubscribeRss } = vi.hoisted(() => ({
  handlers: new Map<string, (event: unknown, folderPath: string) => Promise<IpcResultDTO<unknown>>>(),
  updateRss: vi.fn().mockResolvedValue({ addedCount: 1 }),
  unsubscribeRss: vi.fn().mockResolvedValue(undefined)
}));

vi.mock("electron", () => ({
  ipcMain: { handle: (channel: string, callback: never) => handlers.set(channel, callback) },
  BrowserWindow: { fromWebContents: () => ({ id: 1 }) }
}));
vi.mock("../../apps/desktop/src/main/rss", () => ({ importRss: vi.fn(), updateRss, unsubscribeRss }));
vi.mock("../../apps/desktop/src/main/window-manager", () => ({
  windowManager: {
    getEntryById: () => entry,
    getEntryByWebContents: () => entry
  }
}));

import { registerRssHandlers } from "../../apps/desktop/src/main/ipc/rss-handler";

const entry = {
  workspacePath: path.resolve("canonical-workspace"),
  scannedWorkspacePath: "//approved.invalid/share/notes",
  rendererUrl: RENDERER_URL
};
const folderAlias = `${entry.scannedWorkspacePath}/feed`;
const folderPath = path.join(entry.workspacePath, "feed");

describe("RSS IPC workspace paths", () => {
  const platform = Object.getOwnPropertyDescriptor(process, "platform")!;

  beforeEach(() => {
    vi.clearAllMocks();
    handlers.clear();
    registerRssHandlers();
    Object.defineProperty(process, "platform", { ...platform, value: "win32" });
  });

  afterEach(() => {
    Object.defineProperty(process, "platform", platform);
    vi.restoreAllMocks();
  });

  it.each([
    ["rss:update", updateRss, "RSS_UPDATE_FAILED"],
    ["rss:unsubscribe", unsubscribeRss, "RSS_UNSUBSCRIBE_FAILED"]
  ] as const)("allows %s through the selected alias and rejects other shares", async (channel, action, code) => {
    const realPaths = new Map([
      [entry.workspacePath, entry.workspacePath],
      [path.resolve(entry.scannedWorkspacePath), entry.workspacePath],
      [path.resolve(folderAlias), folderPath]
    ]);
    const realpath = vi.spyOn(fs.realpathSync, "native").mockImplementation((candidate) => {
      const resolved = realPaths.get(String(candidate));
      if (!resolved) throw new Error("Unexpected filesystem lookup");
      return resolved;
    });
    const lstat = vi.spyOn(fs, "lstatSync").mockReturnValue({} as fs.Stats);
    vi.spyOn(fs, "statSync").mockReturnValue({ isDirectory: () => true } as fs.Stats);
    const event = trustedIpcEvent({ id: 1 });
    const handler = handlers.get(channel)!;

    expect(await handler(event, folderAlias)).toMatchObject({ ok: true });
    expect(action).toHaveBeenCalledExactlyOnceWith(folderPath);
    realpath.mockClear();
    lstat.mockClear();

    expect(await handler(event, "//unapproved.invalid/share/notes/feed")).toMatchObject({
      ok: false,
      error: { code, message: "RSS folder is outside workspace" }
    });
    expect(realpath).not.toHaveBeenCalled();
    expect(lstat).not.toHaveBeenCalled();
    expect(action).toHaveBeenCalledTimes(1);
  });
});
