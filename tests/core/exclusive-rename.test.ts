import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, it, vi } from "vitest";

const { bind } = vi.hoisted(() => ({ bind: vi.fn() }));
vi.mock("koffi", () => ({ default: { load: () => ({ func: bind }) } }));

import { writeExportDirectory } from "../../apps/desktop/src/main/export/output";

it("uses compatible directory publication when Linux libc lacks renameat2", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "zhiyuan-rename-symbol-"));
  const platform = Object.getOwnPropertyDescriptor(process, "platform")!;
  bind.mockImplementation(() => {
    throw new Error("Cannot find function 'renameat2' in shared library");
  });
  Object.defineProperty(process, "platform", { ...platform, value: "linux" });
  try {
    const output = path.join(root, "pages");
    await writeExportDirectory(output, (staged) => fs.writeFile(path.join(staged, "page.png"), "image"));

    expect(bind).toHaveBeenCalledExactlyOnceWith("renameat2", "int", ["int", "str", "int", "str", "uint"]);
    expect(await fs.readFile(path.join(output, "page.png"), "utf8")).toBe("image");
    expect(await fs.readdir(root)).toEqual(["pages"]);
  } finally {
    Object.defineProperty(process, "platform", platform);
    await fs.rm(root, { recursive: true, force: true });
  }
});
