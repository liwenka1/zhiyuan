import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { getSystemErrorName } from "node:util";

const RENAME_EXCL = 0x00000004;
const RENAME_NOREPLACE = 1;
const AT_FDCWD = -100;
const WINDOWS_EXISTS_ERRORS = new Set([80, 183]); // ERROR_FILE_EXISTS and ERROR_ALREADY_EXISTS.
const WINDOWS_UNSUPPORTED_ERRORS = new Set([1, 50, 120]); // Invalid function, unsupported request, unimplemented call.

type Rename = (source: string, destination: string) => Promise<void>;
type RenameCallback = (error: Error | null, result: number) => void;
type NativeRename = (source: string, destination: string, done: RenameCallback) => void;

let exclusiveRename: Promise<Rename> | undefined;

async function loadKoffi(): Promise<Pick<typeof import("koffi"), "load" | "errno">> {
  const binding = process.resourcesPath && path.join(process.resourcesPath, "koffi.node");
  if (binding && existsSync(binding)) {
    return createRequire(import.meta.url)(binding);
  }
  return (await import("koffi")).default;
}

function renameError(code: string, details = code): NodeJS.ErrnoException {
  return Object.assign(new Error(`Could not publish the export folder (${details}).`), { code });
}

function wrapRename(rename: NativeRename, succeeded: (result: number) => boolean, failure: () => Error): Rename {
  return (source, destination) =>
    new Promise<void>((resolve, reject) => {
      rename(source, destination, (error, result) => {
        if (error) reject(error);
        else if (succeeded(result)) resolve();
        else reject(failure());
      });
    });
}

async function loadExclusiveRename(): Promise<Rename> {
  const koffi = await loadKoffi();
  if (process.platform === "win32") {
    const kernel = koffi.load("kernel32.dll");
    const move = kernel.func("__stdcall", "MoveFileExW", "int", ["str16", "str16", "uint32_t"]);
    const getLastError = kernel.func("__stdcall", "GetLastError", "uint32_t", []);
    return wrapRename(
      (source, destination, done) =>
        move.async(path.toNamespacedPath(source), path.toNamespacedPath(destination), 0, done),
      (result) => result !== 0,
      () => {
        const code = getLastError() as number;
        const name = WINDOWS_EXISTS_ERRORS.has(code)
          ? "EEXIST"
          : WINDOWS_UNSUPPORTED_ERRORS.has(code)
            ? "ENOTSUP"
            : "EIO";
        return renameError(name, `Windows error ${code}`);
      }
    );
  }

  const libc = koffi.load(null);
  const failure = () => {
    const errno = koffi.errno();
    return renameError(errno > 0 ? getSystemErrorName(-errno) : "EIO");
  };
  if (process.platform === "darwin") {
    const rename = libc.func("renamex_np", "int", ["str", "str", "uint"]);
    return wrapRename(
      (source, destination, done) => rename.async(source, destination, RENAME_EXCL, done),
      (r) => r === 0,
      failure
    );
  }
  if (process.platform === "linux") {
    let rename: ReturnType<typeof libc.func>;
    try {
      rename = libc.func("renameat2", "int", ["int", "str", "int", "str", "uint"]);
    } catch (cause) {
      // Linux libc implementations can omit the wrapper even when the kernel supports renameat2.
      throw Object.assign(renameError("ENOTSUP"), { cause });
    }
    return wrapRename(
      (source, destination, done) => rename.async(AT_FDCWD, source, AT_FDCWD, destination, RENAME_NOREPLACE, done),
      (result) => result === 0,
      failure
    );
  }
  throw renameError("ENOTSUP");
}

/** Move a prepared directory to an absent destination on the same volume. */
export async function renameExclusive(source: string, destination: string): Promise<void> {
  if (source.includes("\0") || destination.includes("\0")) throw renameError("EINVAL");
  const rename = await (exclusiveRename ??= loadExclusiveRename());
  await rename(source, destination);
}
