#!/usr/bin/env node
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const desktopRoot = path.join(repoRoot, "apps", "desktop");
const outputRoot = path.join(desktopRoot, "out");
const packageJsonPath = path.join(desktopRoot, "package.json");

const requiredFiles = ["main/index.js", "preload/index.cjs", "renderer/index.html"];

for (const relativePath of requiredFiles) {
  const filePath = path.join(outputRoot, relativePath);
  let fileStats;
  try {
    fileStats = await stat(filePath);
  } catch {
    throw new Error(`Missing desktop build artifact: ${relativePath}`);
  }
  if (!fileStats.isFile() || fileStats.size === 0) {
    throw new Error(`Desktop build artifact is empty: ${relativePath}`);
  }
}

const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
if (typeof packageJson.version !== "string" || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?$/.test(packageJson.version)) {
  throw new Error(`Invalid desktop package version: ${packageJson.version}`);
}

const rendererIndex = await readFile(path.join(outputRoot, "renderer/index.html"), "utf8");
if (!/<script\s+type="module"[^>]+src="\.\/assets\/[^"']+\.js"/.test(rendererIndex)) {
  throw new Error("Renderer entry script is missing from the desktop build");
}

console.log(`desktop build verified: v${packageJson.version}`);
