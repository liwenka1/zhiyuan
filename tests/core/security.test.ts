import { mkdtemp, mkdir, rm, symlink } from "node:fs/promises";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  isValidFileNameSegment,
  isValidWorkspaceEntryName,
  isValidWorkspaceFolderName,
  normalizeFileNameSegment
} from "../../apps/desktop/src/shared/file-name";
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

  it("rejects hidden workspace entries without forbidding hidden resource directories", () => {
    expect(isValidWorkspaceEntryName(".draft")).toBe(false);
    expect(isValidWorkspaceEntryName(".draft.md")).toBe(false);
    expect(isValidWorkspaceEntryName("draft")).toBe(true);
    expect(isValidFileNameSegment(".assets")).toBe(true);
    expect(isValidWorkspaceFolderName("dist")).toBe(false);
    expect(isValidWorkspaceFolderName("BUILD")).toBe(false);
    expect(isValidWorkspaceFolderName("notes")).toBe(true);
    expect(isValidWorkspaceEntryName("dist")).toBe(true);
  });
});

describe("workspace path policy", () => {
  it("allows a scanned UNC alias only while it resolves to the selected workspace", () => {
    const platform = Object.getOwnPropertyDescriptor(process, "platform")!;
    const workspacePath = path.resolve("canonical-workspace");
    const scannedWorkspacePath = "//approved.invalid/share/notes";
    const aliasedFile = `${scannedWorkspacePath}/note.md`;
    const file = path.join(workspacePath, "note.md");
    const unrelated = path.resolve("another-workspace");
    let aliasRoot = workspacePath;
    const lstat = vi.spyOn(fs, "lstatSync").mockReturnValue({} as fs.Stats);
    const stat = vi.spyOn(fs, "statSync").mockReturnValue({ isDirectory: () => true } as fs.Stats);
    const realpath = vi.spyOn(fs.realpathSync, "native").mockImplementation((candidate) => {
      if (candidate === path.resolve(scannedWorkspacePath)) return aliasRoot;
      if (candidate === path.resolve(aliasedFile)) return file;
      return String(candidate);
    });
    Object.defineProperty(process, "platform", { ...platform, value: "win32" });
    try {
      const workspace = { workspacePath, scannedWorkspacePath };
      expect(validatePathInWorkspace(workspace, aliasedFile)).toEqual({ isValid: true, normalizedPath: file });
      lstat.mockClear();
      realpath.mockClear();

      const sibling = "//approved.invalid/share/notes-other/note.md";
      expect(validatePathInWorkspace(workspace, sibling).isValid).toBe(false);
      expect(realpath).not.toHaveBeenCalled();

      aliasRoot = unrelated;
      expect(validatePathInWorkspace(workspace, aliasedFile).isValid).toBe(false);
      expect(lstat).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(process, "platform", platform);
      realpath.mockRestore();
      stat.mockRestore();
      lstat.mockRestore();
    }
  });
  it("rejects Windows shares outside the selected workspace before any filesystem probe", () => {
    const platform = Object.getOwnPropertyDescriptor(process, "platform")!;
    const workspace = path.resolve("workspace");
    const realpath = vi.spyOn(fs.realpathSync, "native").mockImplementation(() => {
      throw new Error("No filesystem access in this test");
    });
    Object.defineProperty(process, "platform", { ...platform, value: "win32" });
    try {
      expect(validatePathInWorkspace(workspace, "//unapproved.invalid/share/image.png")).toMatchObject({
        isValid: false,
        reason: "Network path is outside the workspace"
      });
      expect(validatePathInWorkspace("//server/share/notes", "//server/share/notes-other/image.png").isValid).toBe(
        false
      );
      expect(validatePathInWorkspace("//server/share/notes", "//other-server/share/notes/image.png").isValid).toBe(
        false
      );
      expect(realpath).not.toHaveBeenCalled();

      validatePathInWorkspace("//server/share/notes", "//SERVER/share/notes/assets/image.png");
      expect(realpath).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(process, "platform", platform);
      realpath.mockRestore();
    }
  });

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
      const dangling = path.join(workspace, "unavailable");
      await symlink(path.join(outside, "missing"), dangling, "dir");
      expect(validatePathInWorkspace(workspace, dangling).isValid).toBe(false);
      expect(validatePathInWorkspace(workspace, path.join(dangling, "new.md")).isValid).toBe(false);
      expect(validatePathInWorkspace(workspace, "notes/new.md").isValid).toBe(false);
      expect(isPathInside(workspace, workspace)).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("remote URL policy", () => {
  it.each([
    "http://127.0.0.1/",
    "http://[::1]/",
    "http://[::ffff:7f00:1]/",
    "http://[fe90::1]/",
    "http://100.64.0.1/",
    "http://100.100.100.200/",
    "http://[::ffff:6464:64c8]/"
  ])("blocks private address %s", async (url) => {
    await expect(assertSafeRemoteHttpUrl(url)).rejects.toThrow(/Private network URLs/);
  });
});

describe("workspace scan policy", () => {
  it("ignores generated trees and keeps a finite recursion bound", () => {
    expect(isIgnoredWorkspaceDirectory("node_modules")).toBe(true);
    expect(isIgnoredWorkspaceDirectory("dist")).toBe(true);
    expect(isIgnoredWorkspaceDirectory("notes")).toBe(false);
    expect(MAX_WORKSPACE_DEPTH).toBeGreaterThan(0);
  });
});
