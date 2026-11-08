import { mkdtemp, mkdir, rm, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isValidFileNameSegment, normalizeFileNameSegment } from "../../apps/desktop/src/shared/file-name";
import { isPathInside, validatePathInWorkspace } from "../../apps/desktop/src/main/security/path-validator";
import { assertSafeRemoteHttpUrl } from "../../apps/desktop/src/main/security/remote-url";
import { isIgnoredWorkspaceDirectory, MAX_WORKSPACE_DEPTH } from "../../apps/desktop/src/main/workspace/policy";

describe("file name policy", () => {
  it("rejects traversal, reserved names, and surrounding whitespace", () => {
    expect(isValidFileNameSegment("note")).toBe(true);
    expect(isValidFileNameSegment(" note ")).toBe(false);
    expect(isValidFileNameSegment("../secret")).toBe(false);
    expect(isValidFileNameSegment("CON")).toBe(false);
    expect(normalizeFileNameSegment(" note ")).toBe("note");
  });
});

describe("workspace path policy", () => {
  it("rejects symlink escapes while allowing new files below real directories", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "zhiyuan-path-test-"));
    const workspace = path.join(root, "workspace");
    const outside = path.join(root, "outside");
    await mkdir(workspace);
    await mkdir(outside);

    try {
      await symlink(outside, path.join(workspace, "linked"), "dir");
      expect(validatePathInWorkspace(workspace, path.join(workspace, "linked", "new.md")).isValid).toBe(false);
      expect(validatePathInWorkspace(workspace, path.join(workspace, "notes", "new.md")).isValid).toBe(true);
      expect(isPathInside(workspace, workspace)).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("remote URL policy", () => {
  it.each(["http://127.0.0.1/", "http://[::1]/", "http://[::ffff:7f00:1]/", "http://[fe90::1]/"])(
    "blocks private address %s",
    async (url) => {
      await expect(assertSafeRemoteHttpUrl(url)).rejects.toThrow(/Private network URLs/);
    }
  );
});

describe("workspace scan policy", () => {
  it("ignores generated trees and keeps a finite recursion bound", () => {
    expect(isIgnoredWorkspaceDirectory("node_modules")).toBe(true);
    expect(isIgnoredWorkspaceDirectory("dist")).toBe(true);
    expect(isIgnoredWorkspaceDirectory("notes")).toBe(false);
    expect(MAX_WORKSPACE_DEPTH).toBeGreaterThan(0);
  });
});
