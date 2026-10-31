import assert from "node:assert/strict";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const fileNameSource = await fsp.readFile("apps/desktop/src/shared/file-name.ts", "utf8");
const pathValidatorSource = await fsp.readFile("apps/desktop/src/main/security/path-validator.ts", "utf8");
const remoteUrlSource = await fsp.readFile("apps/desktop/src/main/security/remote-url.ts", "utf8");
const workspaceHandlerSource = await fsp.readFile("apps/desktop/src/main/ipc/workspace-handler.ts", "utf8");
const fileSystemSource = await fsp.readFile("apps/desktop/src/main/file-system/index.ts", "utf8");
const workspaceSource = await fsp.readFile("apps/desktop/src/main/workspace/index.ts", "utf8");
const watcherSource = await fsp.readFile("apps/desktop/src/main/file-watcher/index.ts", "utf8");
const githubHandlerSource = await fsp.readFile("apps/desktop/src/main/ipc/github-handler.ts", "utf8");
assert.match(fileNameSource, /WINDOWS_RESERVED_NAMES/);
assert.match(pathValidatorSource, /realpathSync/);
assert.match(remoteUrlSource, /mappedIpv4FromIpv6/);
assert.match(remoteUrlSource, /hostname: target\.address/);
assert.match(workspaceHandlerSource, /workspace:approveDroppedFile/);
assert.match(fileSystemSource, /isCaseOnlyRename/);
assert.match(workspaceSource, /MAX_WORKSPACE_DEPTH/);
assert.match(watcherSource, /depth: MAX_WORKSPACE_DEPTH/);
assert.match(githubHandlerSource, /payload\.projectKey/);

function isValidFileNameSegment(value) {
  const name = value.trim();
  if (!name || name === "." || name === "..") return false;
  if (/[\\/:*?"<>|]/.test(name)) return false;
  if ([...name].some((char) => char.charCodeAt(0) < 32)) return false;
  if (name.endsWith(".") || name.endsWith(" ")) return false;
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i.test(name)) return false;
  return true;
}

function normalizePath(targetPath) {
  const absolutePath = path.resolve(targetPath);
  const missingParts = [];
  let existingPath = absolutePath;
  while (!fs.existsSync(existingPath)) {
    const parent = path.dirname(existingPath);
    if (parent === existingPath) return absolutePath;
    missingParts.unshift(path.basename(existingPath));
    existingPath = parent;
  }
  return path.join(fs.realpathSync(existingPath), ...missingParts);
}

function validatePathInWorkspace(workspacePath, targetPath) {
  const base = normalizePath(workspacePath);
  const target = normalizePath(targetPath);
  const relative = path.relative(base, target);
  return {
    isValid: relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
  };
}

assert.equal(isValidFileNameSegment("My note"), true);
assert.equal(isValidFileNameSegment("../secret"), false);
assert.equal(isValidFileNameSegment("CON"), false);
assert.equal(isValidFileNameSegment("note/name"), false);

const root = await fsp.mkdtemp(path.join(os.tmpdir(), "zhiyuan-core-test-"));
const workspace = path.join(root, "workspace");
const outside = path.join(root, "outside");
await fsp.mkdir(workspace);
await fsp.mkdir(outside);
const link = path.join(workspace, "linked");

try {
  fs.symlinkSync(outside, link, "dir");
  assert.equal(validatePathInWorkspace(workspace, path.join(workspace, "linked", "new.md")).isValid, false);
  assert.equal(validatePathInWorkspace(workspace, path.join(workspace, "notes", "new.md")).isValid, true);
} finally {
  await fsp.rm(root, { recursive: true, force: true });
}

console.log("core security tests passed");
