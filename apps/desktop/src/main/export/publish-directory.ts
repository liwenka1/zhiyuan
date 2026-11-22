import { closeSync, constants, fstatSync, lstatSync, mkdirSync, openSync, rmdirSync, type BigIntStats } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { publishStagedFile, removePublishedFile } from "../file-system/staged-output";

interface CreatedDirectory {
  path: string;
  stat: BigIntStats;
  descriptor?: number;
}

const DIRECTORY_OPEN_FALLBACK_CODES = new Set(["EACCES", "EPERM", "EINVAL", "ENOTSUP", "EMFILE", "ENFILE"]);

function openDirectory(directoryPath: string): number | undefined {
  if (!constants.O_NOFOLLOW || !constants.O_DIRECTORY) return undefined;
  try {
    return openSync(directoryPath, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_DIRECTORY);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (!code || !DIRECTORY_OPEN_FALLBACK_CODES.has(code)) throw error;
    return undefined;
  }
}

function getDirectoryStat(directoryPath: string, descriptor?: number): BigIntStats {
  const stat =
    descriptor === undefined ? lstatSync(directoryPath, { bigint: true }) : fstatSync(descriptor, { bigint: true });
  if (!stat.isDirectory() || stat.ino === 0n) throw new Error("Cannot verify the export directory");
  return stat;
}

function isSameDirectory(current: BigIntStats, expected: BigIntStats): boolean {
  return current.dev === expected.dev && current.ino === expected.ino;
}

function verifyDirectory(directory: CreatedDirectory): void {
  const current = getDirectoryStat(directory.path);
  if (!isSameDirectory(current, directory.stat)) {
    throw new Error("Export destination changed. Select it again to continue.");
  }
}

function reserveDirectory(directoryPath: string): CreatedDirectory {
  // A retained descriptor identifies the reservation even when pathname metadata fails.
  mkdirSync(directoryPath);
  const descriptor = openDirectory(directoryPath);
  try {
    return { path: directoryPath, stat: getDirectoryStat(directoryPath, descriptor), descriptor };
  } catch (error) {
    if (descriptor !== undefined) closeSync(descriptor);
    throw error;
  }
}

function removeReservedDirectory(directory: CreatedDirectory): void {
  const descriptor = directory.descriptor === undefined ? undefined : openDirectory(directory.path);
  try {
    if (isSameDirectory(getDirectoryStat(directory.path, descriptor), directory.stat)) rmdirSync(directory.path);
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

/** Publish exclusively on volumes that lack an atomic directory move. */
export async function publishDirectoryContents(stagedPath: string, outputPath: string): Promise<void> {
  const directories: CreatedDirectory[] = [];
  const publishedFiles = new Map<string, BigIntStats>();

  async function publish(stagedPath: string, outputPath: string, parents: CreatedDirectory[]): Promise<void> {
    parents.forEach(verifyDirectory);
    const directory = reserveDirectory(outputPath);
    directories.push(directory);
    verifyDirectory(directory);
    const outputDirectories = [...parents, directory];
    const verifyDestination = () => outputDirectories.forEach(verifyDirectory);
    for (const entry of await fs.readdir(stagedPath, { withFileTypes: true })) {
      const from = path.join(stagedPath, entry.name);
      const to = path.join(outputPath, entry.name);
      if (entry.isDirectory()) {
        await publish(from, to, outputDirectories);
      } else if (entry.isFile()) {
        const file = await publishStagedFile(from, to, verifyDestination);
        if (file) publishedFiles.set(to, file);
      } else {
        throw new Error("Unexpected entry in the staged export");
      }
      verifyDestination();
    }
  }

  try {
    await publish(stagedPath, outputPath, []);
    directories.forEach(verifyDirectory);
  } catch (error) {
    for (const [file, identity] of publishedFiles) removePublishedFile(file, identity);
    for (const directory of directories.reverse()) {
      try {
        removeReservedDirectory(directory);
      } catch {
        // Keep replaced directories and directories containing unrelated files.
      }
    }
    throw error;
  } finally {
    for (const directory of directories) {
      if (directory.descriptor !== undefined) closeSync(directory.descriptor);
    }
  }
}
