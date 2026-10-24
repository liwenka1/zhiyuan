#!/usr/bin/env node
/**
 * 原生依赖检查（替代无条件的 `electron-builder install-app-deps`）。
 *
 * desktop 端唯一的运行时原生模块是 node-pty，它基于 node-addon-api（N-API），
 * 二进制跨 Node / Electron ABI 通用，并且随包发布了 win32/darwin 的预编译产物
 * （prebuilds/<platform>-<arch>，没有 linux）。
 * 加载顺序见 node-pty/lib/utils.js：build/Release → build/Debug → prebuilds。
 *
 * 所以只有两种二进制都不存在时才需要本地编译。而 `electron-builder
 * install-app-deps` 是无条件 rebuild 的（app-builder-lib 的 installOrRebuild
 * 不判断 npmRebuild），在 Windows 上会强制走 node-gyp，进而因为缺少
 * Visual Studio 直接失败。这里改成按需触发。
 *
 * 用法：
 *   node scripts/ensure-app-deps.mjs             # postinstall 使用
 *   node scripts/ensure-app-deps.mjs --dry-run   # 只打印判断结果，不执行 rebuild
 */
import { execSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);

const isDryRun = process.argv.includes("--dry-run");
const platform = process.env.NATIVE_DEPS_PLATFORM ?? process.platform;
const arch = process.env.NATIVE_DEPS_ARCH ?? process.arch;

/** 需要保证有可用二进制的运行时原生依赖 */
const NATIVE_DEPS = ["node-pty"];

/** 返回实际可用的二进制目录名，没有则返回 null */
function findBinary(pkgDir) {
  const releaseDir = path.join(pkgDir, "build", "Release");
  if (existsSync(releaseDir) && readdirSync(releaseDir).some((file) => file.endsWith(".node"))) {
    return "build/Release";
  }

  const prebuiltDir = path.join(pkgDir, "prebuilds", `${platform}-${arch}`);
  if (existsSync(prebuiltDir) && readdirSync(prebuiltDir).some((file) => file.endsWith(".node"))) {
    return `prebuilds/${platform}-${arch}`;
  }

  return null;
}

const missing = [];

for (const dep of NATIVE_DEPS) {
  let pkgDir;
  try {
    pkgDir = path.dirname(require.resolve(`${dep}/package.json`));
  } catch {
    console.log(`> ${dep}: 未安装，跳过`);
    continue;
  }

  const binary = findBinary(pkgDir);
  if (binary) {
    console.log(`> ${dep}: 使用 ${binary} 的原生二进制，无需重新编译`);
  } else {
    console.log(`> ${dep}: 缺少 ${platform}-${arch} 的原生二进制，需要重新编译`);
    missing.push(dep);
  }
}

if (missing.length === 0) {
  console.log("> 原生依赖已就绪，跳过 electron-builder install-app-deps");
  process.exit(0);
}

console.log(`> 对 ${missing.join(", ")} 执行 electron-builder install-app-deps`);
if (isDryRun) {
  console.log("> --dry-run：不执行");
  process.exit(0);
}

execSync("electron-builder install-app-deps", { stdio: "inherit", shell: process.platform === "win32" });
