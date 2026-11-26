import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

export const requireNative = createRequire(import.meta.url);

export function loadPackagedKoffi(): typeof import("koffi") | undefined {
  const binding = process.resourcesPath && path.join(process.resourcesPath, "koffi.node");
  return binding && existsSync(binding) ? requireNative(binding) : undefined;
}
