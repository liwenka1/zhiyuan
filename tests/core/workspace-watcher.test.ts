import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const { watchMock } = vi.hoisted(() => ({ watchMock: vi.fn() }));
vi.mock("chokidar", async () => {
  const { EventEmitter } = await import("node:events");
  return {
    default: {
      watch: (...args: unknown[]) => {
        watchMock(...args);
        return Object.assign(new EventEmitter(), { close: vi.fn() });
      }
    }
  };
});
vi.mock("electron", () => ({ BrowserWindow: { fromId: vi.fn() } }));

import { fileWatcherManager } from "../../apps/desktop/src/main/file-watcher";
import { MAX_WORKSPACE_DEPTH } from "../../apps/desktop/src/main/workspace/policy";

const workspace = path.join(os.tmpdir(), "zhiyuan-watcher-depth-test");
afterEach(() => {
  fileWatcherManager.stopWatching(workspace, 1);
  vi.clearAllMocks();
});

describe("workspace watcher discovery", () => {
  it("watches markdown at the deepest scanned directory without descending another level", () => {
    fileWatcherManager.startWatching(workspace, 1);
    const ignore = watchMock.mock.calls[0][1].ignored as (target: string, stats?: fs.Stats) => boolean;
    const deepestDirectory = path.join(
      workspace,
      ...Array.from({ length: MAX_WORKSPACE_DEPTH }, (_, index) => `d${index}`)
    );
    const fileStats = { isFile: () => true, isDirectory: () => false } as fs.Stats;
    const directoryStats = { isFile: () => false, isDirectory: () => true } as fs.Stats;

    expect(ignore(deepestDirectory, directoryStats)).toBe(false);
    expect(ignore(path.join(deepestDirectory, "note.md"))).toBe(false);
    expect(ignore(path.join(deepestDirectory, "note.md"), fileStats)).toBe(false);
    expect(ignore(path.join(deepestDirectory, "deeper"), directoryStats)).toBe(true);
    expect(ignore(path.join(deepestDirectory, "deeper", "note.md"), fileStats)).toBe(true);
  });
});
