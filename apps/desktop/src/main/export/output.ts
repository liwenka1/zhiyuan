import fs from "node:fs/promises";
import { constants, type Stats } from "node:fs";
import * as path from "node:path";
import { renameExclusive } from "../file-system/exclusive-rename";
import { writeStagedFile } from "../file-system/staged-output";
import { publishDirectoryContents } from "./publish-directory";

export interface ExportDestination {
  outputPath: string;
  existing: Stats | null;
}

const activeOverwrites = new Set<string>();
const DESTINATION_CHANGED = "Export destination changed. Select it again to continue.";
const DIRECTORY_EXISTS = "Export folder already exists. Choose a new folder name.";
const UNSUPPORTED_RENAME_ERRORS = new Set(["EINVAL", "ENOSYS", "ENOTSUP", "EOPNOTSUPP"]);

async function getExistingOutput(outputPath: string): Promise<Stats | null> {
  try {
    return await fs.lstat(outputPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function inspectExportDestination(outputPath: string): Promise<ExportDestination> {
  return { outputPath, existing: await getExistingOutput(outputPath) };
}

export async function writeExportDirectory<T>(
  outputPath: string,
  prepare: (stagingDirectory: string) => Promise<T>
): Promise<T> {
  if (await getExistingOutput(outputPath)) throw new Error(DIRECTORY_EXISTS);
  const stagingRoot = await fs.mkdtemp(path.join(path.dirname(outputPath), ".zhiyuan-export-"));
  const stagingDirectory = path.join(stagingRoot, "output");
  try {
    // The parent keeps the staging tree private. The output directory itself follows the usual umask.
    await fs.mkdir(stagingDirectory);
    const result = await prepare(stagingDirectory);
    try {
      await renameExclusive(stagingDirectory, outputPath).catch(async (error: unknown) => {
        const code = (error as NodeJS.ErrnoException | null)?.code;
        if (!code || !UNSUPPORTED_RENAME_ERRORS.has(code)) throw error;
        await publishDirectoryContents(stagingDirectory, outputPath);
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException | null)?.code === "EEXIST") throw new Error(DIRECTORY_EXISTS);
      throw error;
    }
    return result;
  } finally {
    await fs.rm(stagingRoot, { recursive: true, force: true }).catch(() => {});
  }
}

export async function writeExportFile(
  { outputPath, existing }: ExportDestination,
  content: string | Uint8Array
): Promise<void> {
  if (existing) {
    if (!existing.isFile()) throw new Error("Export destination is not a regular file.");
    const key = `${existing.dev}:${existing.ino}`;
    if (activeOverwrites.has(key)) throw new Error(DESTINATION_CHANGED);
    activeOverwrites.add(key);
    try {
      // Write through the selected inode to preserve ownership, ACLs and extended attributes.
      const output = await fs.open(outputPath, constants.O_WRONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
      try {
        const current = await output.stat();
        if (
          !current.isFile() ||
          current.dev !== existing.dev ||
          current.ino !== existing.ino ||
          current.size !== existing.size ||
          current.mtimeMs !== existing.mtimeMs ||
          current.ctimeMs !== existing.ctimeMs
        ) {
          throw new Error(DESTINATION_CHANGED);
        }
        await output.writeFile(content);
        await output.truncate(Buffer.byteLength(content));
        await output.sync();
      } finally {
        await output.close();
      }
    } finally {
      activeOverwrites.delete(key);
    }
    return;
  }

  try {
    await writeStagedFile(outputPath, content);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new Error(DESTINATION_CHANGED);
    throw error;
  }
}
