#!/usr/bin/env node
/**
 * 同步发版入口的提示版本（.github/workflows/release.yml 里 workflow_dispatch 的 version 输入）。
 *
 * 由 release workflow 的 finalize job 在 release 正式发布之后调用：
 *   node scripts/sync-release-input.mjs 0.0.7
 *
 * 只维护 BEGIN/END 标记之间的内容：
 *   - description 里的 `Last released: X`（本次发布的版本）
 *   - default 里的下一个版本（稳定版 patch+1；prerelease 直接转正，如 0.0.9-beta → 0.0.9）
 *
 * GitHub 不支持在 inputs 里写表达式，所以这两个值只能靠提交来刷新。
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WORKFLOW_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  ".github",
  "workflows",
  "release.yml"
);

const BEGIN = "      # >>> release-input:begin";
const END = "      # <<< release-input:end";

const released = (process.argv[2] ?? "").trim().replace(/^v/, "");
if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.]+)?$/.test(released)) {
  console.error(`无效版本号：${released || "(空)"}`);
  process.exit(1);
}

/** 0.0.7 → 0.0.8；0.0.9-beta → 0.0.9（预发布的下一个就是它的正式版） */
function computeNext(version) {
  const [core, ...pre] = version.split("-");
  if (pre.length > 0) {
    return core;
  }
  const [major, minor, patch] = core.split(".").map(Number);
  return `${major}.${minor}.${patch + 1}`;
}

const next = computeNext(released);

const block = [
  BEGIN,
  "      # 由 scripts/sync-release-input.mjs 在每次正式发布后自动维护，请勿手改",
  "      version:",
  `        description: "Version to release, without the leading v. Last released: ${released}"`,
  `        default: "${next}"`,
  "        required: true",
  "        type: string",
  END,
].join("\n");

const source = readFileSync(WORKFLOW_PATH, "utf8");
const pattern = new RegExp(
  `${BEGIN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?${END.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`
);

if (!pattern.test(source)) {
  console.error("未找到 release-input 标记，请检查 .github/workflows/release.yml");
  process.exit(1);
}

const updated = source.replace(pattern, block);

if (updated === source) {
  console.log(`发版入口提示已是最新（last released: ${released}, next: ${next}）`);
  process.exit(0);
}

writeFileSync(WORKFLOW_PATH, updated);
console.log(`已更新发版入口提示（last released: ${released}, next: ${next}）`);
