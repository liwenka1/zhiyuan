import { randomBytes } from "node:crypto";
import { createReadStream, lstatSync, unlinkSync, type BigIntStats } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

const unsupportedLinkErrors = new Set([
  "EACCES",
  "EINVAL",
  "EMLINK",
  "ENOSYS",
  "ENOTSUP",
  "EOPNOTSUPP",
  "EPERM",
  "EXDEV"
]);

function isSameEntry(current: BigIntStats, expected: BigIntStats): boolean {
  return expected.ino !== 0n && current.dev === expected.dev && current.ino === expected.ino;
}

export function removePublishedFile(outputPath: string, expected: BigIntStats): void {
  try {
    const current = lstatSync(outputPath, { bigint: true });
    if (
      isSameEntry(current, expected) &&
      current.isFile() &&
      expected.isFile() &&
      current.size === expected.size &&
      current.mtimeNs === expected.mtimeNs &&
      current.ctimeNs === expected.ctimeNs
    ) {
      unlinkSync(outputPath);
    }
  } catch {
    // Leave files that have been moved, replaced, or edited by another writer.
  }
}

async function copyStagedFile(stagedPath: string, outputPath: string, mode: number): Promise<BigIntStats | null> {
  const output = await fs.open(outputPath, "wx", mode);
  try {
    await fs.writeFile(output, createReadStream(stagedPath));
    await output.sync();
    return await output.stat({ bigint: true }).catch(() => null);
  } catch (error) {
    const partial = await output.stat({ bigint: true }).catch(() => null);
    if (partial) removePublishedFile(outputPath, partial);
    throw error;
  } finally {
    await output.close();
  }
}

export async function publishStagedFile(
  stagedPath: string,
  outputPath: string,
  verifyDestination?: () => void
): Promise<BigIntStats | null> {
  const staged = await fs.lstat(stagedPath, { bigint: true });
  verifyDestination?.();
  try {
    await fs.link(stagedPath, outputPath);
  } catch (error) {
    if (!unsupportedLinkErrors.has((error as NodeJS.ErrnoException).code ?? "")) throw error;
    verifyDestination?.();
    const published = await copyStagedFile(stagedPath, outputPath, Number(staged.mode & 0o777n));
    // Reclaim space for each streamed copy before copying another file.
    removePublishedFile(stagedPath, staged);
    return published;
  }
  // Capture the hard-linked inode through its private name for any later rollback.
  const linked = await fs.lstat(stagedPath, { bigint: true }).catch(() => null);
  return linked && isSameEntry(linked, staged) && linked.mtimeNs === staged.mtimeNs && linked.size === staged.size
    ? linked
    : null;
}

export async function writeStagedFile(outputPath: string, content: string | Uint8Array): Promise<void> {
  // A sibling file works in directories where the caller can create files but cannot create subdirectories.
  const stagedPath = path.join(path.dirname(outputPath), `.zhiyuan-${randomBytes(12).toString("hex")}.tmp`);
  const staged = await fs.open(stagedPath, "wx", 0o600);
  try {
    await fs.writeFile(staged, content);
    if (process.platform !== "win32") await staged.chmod(0o666 & ~process.umask());
    await staged.sync();
    await publishStagedFile(stagedPath, outputPath);
  } finally {
    const identity = await staged.stat({ bigint: true }).catch(() => null);
    if (identity) removePublishedFile(stagedPath, identity);
    await staged.close();
  }
}
