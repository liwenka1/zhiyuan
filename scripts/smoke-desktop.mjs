#!/usr/bin/env node
import { createRequire } from "node:module";
import { once } from "node:events";
import { mkdir, mkdtemp, open, readFile, realpath, rm, symlink, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mainEntry = path.join(repoRoot, "apps", "desktop", "out", "main", "index.js");
if (process.argv.length > 3) throw new Error("Usage: pnpm smoke:desktop [path-to-packaged-executable]");
const packagedApp = process.argv[2] ? path.resolve(process.argv[2]) : null;
const executable = packagedApp ?? require("electron");
const launchArgs = packagedApp ? [] : ["--no-sandbox", mainEntry];
const smokeRoot = await realpath(await mkdtemp(path.join(os.tmpdir(), "zhiyuan-desktop-smoke-")));
const workspace = path.join(smokeRoot, "workspace");
const workspaceAlias = path.join(smokeRoot, "workspace-alias");
const noteName = `${"s".repeat(245)}.md`;
const notePath = path.join(workspace, noteName);
const decoyPath = path.join(workspace, "000-decoy.md");
const initialContent = "# Desktop smoke\n\nFixture before edit.\n";
const expectedContent = "# Desktop smoke edited\n\nSaved through the real editor.\n";
const readyMarker = "ZHIYUAN_SMOKE_READY: editor opened, edited and saved";
const terminalMarker = "ZHIYUAN_SMOKE_TERMINAL_READY";
const exportMarker = "ZHIYUAN_SMOKE_EXPORT_READY";
const smokeTimeout = 25_000;

function waitForExit(child) {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  return new Promise((resolve) => {
    const onExit = () => {
      clearTimeout(fallback);
      resolve();
    };
    const fallback = setTimeout(() => {
      child.removeListener("exit", onExit);
      resolve();
    }, 2_000);
    child.once("exit", onExit);
  });
}

async function runSmokeCase(name, startupPath) {
  await writeFile(notePath, initialContent);
  // The first row must not be a usable substitute for the argv-selected note.
  const newer = new Date(Date.now() + 60_000);
  await utimes(decoyPath, newer, newer);
  const profileRoot = path.join(smokeRoot, `${name}-profile`);
  await mkdir(profileRoot);
  const outputPath = path.join(profileRoot, "electron.log");
  const log = await open(outputPath, "w");
  let child;
  let output;

  try {
    child = spawn(executable, [...launchArgs, startupPath], {
      cwd: repoRoot,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: "",
        ELECTRON_RENDERER_URL: "",
        ZHIYUAN_SMOKE_TEST: "1",
        ZHIYUAN_SMOKE_TERMINAL: process.platform === "darwin" && packagedApp ? "1" : "",
        ZHIYUAN_SMOKE_EXPORT: packagedApp ? "1" : "",
        ZHIYUAN_SMOKE_USER_DATA: profileRoot,
        ZHIYUAN_SMOKE_NOTE: notePath,
        ...(process.platform === "darwin" && packagedApp ? { SHELL: "/bin/sh" } : {}),
        XDG_CONFIG_HOME: path.join(profileRoot, "config"),
        XDG_CACHE_HOME: path.join(profileRoot, "cache"),
        XDG_DATA_HOME: path.join(profileRoot, "data")
      },
      // Chromium descendants can outlive Electron and keep inherited streams open.
      stdio: ["ignore", log.fd, log.fd]
    });

    const [code, signal] = await once(child, "exit", { signal: AbortSignal.timeout(smokeTimeout) }).catch((error) => {
      if (error.name === "AbortError") throw new Error("Desktop editor smoke timed out after 25 seconds");
      throw error;
    });
    output = await readFile(outputPath, "utf8");
    const ready = output.split(/\r?\n/).includes(readyMarker);
    if (!ready || code !== 0 || signal !== null) {
      throw new Error(`Desktop editor smoke failed (code=${code}, signal=${signal}, ready=${ready})`);
    }
    if ((await readFile(notePath, "utf8")) !== expectedContent) {
      throw new Error("Desktop smoke saved unexpected content");
    }
    if (packagedApp && process.platform === "darwin" && !output.split(/\r?\n/).includes(terminalMarker)) {
      throw new Error("Packaged macOS app did not confirm a working terminal");
    }
    if (packagedApp && !output.split(/\r?\n/).includes(exportMarker)) {
      throw new Error("Packaged app did not confirm working image and HTML package exports");
    }
  } catch (error) {
    if (child?.pid !== undefined && child.exitCode === null && child.signalCode === null) {
      child.kill();
      await waitForExit(child);
      if (child.exitCode === null && child.signalCode === null) {
        child.kill("SIGKILL");
        await waitForExit(child);
      }
    }
    output ??= await readFile(outputPath, "utf8").catch(() => "");
    throw new Error(`${name}: ${error.message}\n${output.slice(-32_000)}`);
  } finally {
    await log.close();
  }
  console.log(`desktop editor smoke passed: ${name} startup automatically selected, edited and saved the note`);
  if (packagedApp && process.platform === "darwin") console.log(`desktop terminal smoke passed: ${name} startup`);
  if (packagedApp) console.log(`desktop image and HTML package export smoke passed: ${name} startup`);
}

try {
  await mkdir(workspace);
  await writeFile(decoyPath, "# Decoy note\n\nThis file must not be opened by the smoke test.\n");
  await symlink(workspace, workspaceAlias, process.platform === "win32" ? "junction" : "dir");
  await runSmokeCase("canonical", notePath);
  await runSmokeCase("symlink", path.join(workspaceAlias, noteName));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await rm(smokeRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }).catch(() => {});
}
