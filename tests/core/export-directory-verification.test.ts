import { constants, mkdirSync, renameSync } from "node:fs";
import fs, { mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, it, vi } from "vitest";

const failure = vi.hoisted(() => ({ path: "", openPath: "", beforeFailure: undefined as (() => void) | undefined }));
vi.mock("node:fs", async (importOriginal) => {
  const fs = await importOriginal<typeof import("node:fs")>();
  return {
    ...fs,
    openSync: (file: string, flags: number) => {
      if (file === failure.openPath) throw Object.assign(new Error("Descriptor limit reached"), { code: "EMFILE" });
      return fs.openSync(file, flags);
    },
    lstatSync: (file: string, options: { bigint: true }) => {
      if (file === failure.path) {
        failure.beforeFailure?.();
        failure.beforeFailure = undefined;
        throw Object.assign(new Error("Metadata lookup failed"), { code: "EIO" });
      }
      return fs.lstatSync(file, options);
    }
  };
});

import { publishDirectoryContents } from "../../apps/desktop/src/main/export/publish-directory";

it.skipIf(!constants.O_NOFOLLOW || !constants.O_DIRECTORY).each([false, true])(
  "cleans only the reserved directory when pathname verification fails and replaced=%s",
  async (replaced) => {
    const root = await mkdtemp(path.join(os.tmpdir(), "zhiyuan-export-verification-"));
    const output = path.join(root, "exported");
    const staged = path.join(root, "staged");
    try {
      await mkdir(staged);
      failure.path = output;
      if (replaced) {
        failure.beforeFailure = () => {
          renameSync(output, path.join(root, "moved"));
          mkdirSync(output);
        };
      }

      await expect(publishDirectoryContents(staged, output)).rejects.toThrow("Metadata lookup failed");
      expect((await readdir(root)).sort()).toEqual(replaced ? ["exported", "moved", "staged"] : ["staged"]);
    } finally {
      failure.path = "";
      failure.beforeFailure = undefined;
      await rm(root, { recursive: true, force: true });
    }
  }
);

it.skipIf(!constants.O_NOFOLLOW || !constants.O_DIRECTORY).each([false, true])(
  "can roll back a reservation without a descriptor and keeps a replacement directory=%s",
  async (replaced) => {
    const root = await mkdtemp(path.join(os.tmpdir(), "zhiyuan-export-reservation-"));
    const output = path.join(root, "exported");
    const staged = path.join(root, "staged");
    await mkdir(staged);
    failure.openPath = output;
    const read = vi.spyOn(fs, "readdir").mockImplementationOnce(() => {
      if (replaced) {
        renameSync(output, path.join(root, "moved"));
        mkdirSync(output);
      }
      return Promise.reject(Object.assign(new Error("Descriptor limit reached"), { code: "EMFILE" }));
    });
    try {
      await expect(publishDirectoryContents(staged, output)).rejects.toMatchObject({ code: "EMFILE" });
      expect(read).toHaveBeenCalledOnce();
      expect((await readdir(root)).sort()).toEqual(replaced ? ["exported", "moved", "staged"] : ["staged"]);
      if (!replaced) {
        failure.openPath = "";
        await expect(publishDirectoryContents(staged, output)).resolves.toBeUndefined();
        expect((await readdir(root)).sort()).toEqual(["exported", "staged"]);
      }
    } finally {
      failure.openPath = "";
      read.mockRestore();
      await rm(root, { recursive: true, force: true });
    }
  }
);
