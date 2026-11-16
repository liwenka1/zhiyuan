#!/usr/bin/env node
import { createRequire } from "node:module";
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mainEntry = path.join(repoRoot, "apps", "desktop", "out", "main", "index.js");
const electronBinary = require("electron");
const smokeRoot = await realpath(await mkdtemp(path.join(os.tmpdir(), "zhiyuan-desktop-smoke-")));
const workspace = path.join(smokeRoot, "workspace");
const workspaceAlias = path.join(smokeRoot, "workspace-alias");
const notePath = path.join(workspace, "smoke-note.md");
const decoyPath = path.join(workspace, "000-decoy.md");
const initialContent = "# Desktop smoke\n\nFixture before edit.\n";
const expectedContent = "# Desktop smoke edited\n\nSaved through the real editor.\n";

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
  const output = [];
  let ready = false;
  let finished = false;
  let timeout;

  await new Promise((resolve, reject) => {
    const child = spawn(electronBinary, ["--no-sandbox", mainEntry, startupPath], {
      cwd: repoRoot,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: "",
        ELECTRON_RENDERER_URL: "",
        ZHIYUAN_SMOKE_TEST: "1",
        ZHIYUAN_SMOKE_USER_DATA: profileRoot,
        ZHIYUAN_SMOKE_NOTE: notePath,
        XDG_CONFIG_HOME: path.join(profileRoot, "config"),
        XDG_CACHE_HOME: path.join(profileRoot, "cache"),
        XDG_DATA_HOME: path.join(profileRoot, "data")
      },
      stdio: ["ignore", "pipe", "pipe"]
    });

    const appendOutput = (chunk) => {
      output.push(String(chunk));
      if (output.length > 80) output.shift();
    };
    const finish = async (error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      if (child.exitCode === null && child.signalCode === null) child.kill();
      await waitForExit(child);
      if (child.exitCode === null && child.signalCode === null) {
        child.kill("SIGKILL");
        await waitForExit(child);
      }
      if (error) reject(new Error(`${name}: ${error.message}\n${output.join("")}`));
      else resolve();
    };

    timeout = setTimeout(() => {
      void finish(new Error("Desktop editor smoke timed out after 25 seconds"));
    }, 25_000);
    child.stdout.on("data", (chunk) => {
      appendOutput(chunk);
      if (output.join("").includes("ZHIYUAN_SMOKE_READY")) ready = true;
    });
    child.stderr.on("data", appendOutput);
    child.once("error", (error) => void finish(error));
    child.once("close", async (code, signal) => {
      if (finished) return;
      if (!ready || code !== 0) {
        await finish(new Error(`Desktop editor smoke failed (code=${code}, signal=${signal}, ready=${ready})`));
        return;
      }
      try {
        if ((await readFile(notePath, "utf8")) !== expectedContent)
          throw new Error("Desktop smoke saved unexpected content");
        await finish();
      } catch (error) {
        await finish(error);
      }
    });
  });
  console.log(`desktop editor smoke passed: ${name} startup automatically selected, edited and saved the note`);
}

try {
  await mkdir(workspace);
  await writeFile(decoyPath, "# Decoy note\n\nThis file must not be opened by the smoke test.\n");
  await symlink(workspace, workspaceAlias, process.platform === "win32" ? "junction" : "dir");
  await runSmokeCase("canonical", notePath);
  await runSmokeCase("symlink", path.join(workspaceAlias, "smoke-note.md"));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await rm(smokeRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }).catch(() => {});
}
