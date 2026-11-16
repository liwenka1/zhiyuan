#!/usr/bin/env node
import { createRequire } from "node:module";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mainEntry = path.join(repoRoot, "apps", "desktop", "out", "main", "index.js");
const electronBinary = require("electron");
const smokeRoot = await mkdtemp(path.join(os.tmpdir(), "zhiyuan-desktop-smoke-"));
const workspace = path.join(smokeRoot, "workspace");
await mkdir(workspace);
const notePath = path.join(workspace, "smoke-note.md");
await writeFile(notePath, "# Desktop smoke\n\nFixture before edit.\n");
const expectedContent = "# Desktop smoke edited\n\nSaved through the real editor.\n";

const output = [];
let finished = false;
let timeout;
let ready = false;

function appendOutput(chunk) {
  output.push(String(chunk));
  if (output.length > 80) output.shift();
}

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

async function finish(child, error) {
  if (finished) return;
  finished = true;
  clearTimeout(timeout);
  if (!child.killed && child.exitCode === null) child.kill();
  await waitForExit(child);
  await rm(smokeRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }).catch(() => {});
  if (error) {
    console.error(error.message);
    console.error(output.join(""));
    process.exitCode = 1;
  } else {
    console.log("desktop editor smoke passed: opened, edited and saved a temporary note");
  }
}

const child = spawn(electronBinary, ["--no-sandbox", mainEntry, notePath], {
  cwd: repoRoot,
  env: {
    ...process.env,
    ELECTRON_RUN_AS_NODE: "",
    ELECTRON_RENDERER_URL: "",
    ZHIYUAN_SMOKE_TEST: "1",
    ZHIYUAN_SMOKE_USER_DATA: smokeRoot,
    ZHIYUAN_SMOKE_NOTE: notePath,
    XDG_CONFIG_HOME: path.join(smokeRoot, "config"),
    XDG_CACHE_HOME: path.join(smokeRoot, "cache"),
    XDG_DATA_HOME: path.join(smokeRoot, "data")
  },
  stdio: ["ignore", "pipe", "pipe"]
});

timeout = setTimeout(() => {
  finish(child, new Error("Desktop editor smoke timed out after 25 seconds"));
}, 25_000);

child.stdout.on("data", (chunk) => {
  appendOutput(chunk);
  if (output.join("").includes("ZHIYUAN_SMOKE_READY")) {
    ready = true;
  }
});
child.stderr.on("data", appendOutput);
child.once("error", (error) => finish(child, error));
child.once("close", async (code, signal) => {
  if (!finished) {
    if (!ready || code !== 0) {
      await finish(child, new Error(`Desktop editor smoke failed (code=${code}, signal=${signal}, ready=${ready})`));
      return;
    }
    try {
      if ((await readFile(notePath, "utf8")) !== expectedContent)
        throw new Error("Desktop smoke saved unexpected content");
      await finish(child);
    } catch (error) {
      await finish(child, error);
    }
  }
});
