#!/usr/bin/env node
import { createRequire } from "node:module";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mainEntry = path.join(repoRoot, "apps", "desktop", "out", "main", "index.js");
const electronBinary = require("electron");
const smokeRoot = await mkdtemp(path.join(os.tmpdir(), "zhiyuan-desktop-smoke-"));

const output = [];
let finished = false;
let timeout;

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
    console.log("desktop startup smoke passed");
  }
}

const child = spawn(electronBinary, ["--no-sandbox", mainEntry], {
  cwd: repoRoot,
  env: {
    ...process.env,
    ELECTRON_RUN_AS_NODE: "",
    ZHIYUAN_SMOKE_TEST: "1",
    HOME: smokeRoot,
    XDG_CONFIG_HOME: path.join(smokeRoot, "config"),
    XDG_CACHE_HOME: path.join(smokeRoot, "cache"),
    XDG_DATA_HOME: path.join(smokeRoot, "data")
  },
  stdio: ["ignore", "pipe", "pipe"]
});

timeout = setTimeout(() => {
  finish(child, new Error("Desktop startup smoke timed out after 20 seconds"));
}, 20_000);

child.stdout.on("data", (chunk) => {
  appendOutput(chunk);
  if (String(chunk).includes("ZHIYUAN_SMOKE_READY")) {
    setTimeout(() => finish(child), 100);
  }
});
child.stderr.on("data", appendOutput);
child.once("error", (error) => finish(child, error));
child.once("exit", (code, signal) => {
  if (!finished) {
    finish(child, new Error(`Desktop smoke exited before readiness (code=${code}, signal=${signal})`));
  }
});
