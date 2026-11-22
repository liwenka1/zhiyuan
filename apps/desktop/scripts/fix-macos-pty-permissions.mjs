import { constants, existsSync } from "node:fs";
import { access, chmod, stat } from "node:fs/promises";
import { join } from "node:path";

async function fixMacosPtyPermissions({ appOutDir, electronPlatformName, packager }) {
  if (electronPlatformName !== "darwin" && electronPlatformName !== "mas") return;

  const resourcesDir = packager.getResourcesDir(appOutDir);
  // Universal builds can keep separate application directories for each architecture.
  const appDirs = [
    "app.asar.unpacked",
    "app",
    "app-x64.asar.unpacked",
    "app-arm64.asar.unpacked",
    "app-x64",
    "app-arm64"
  ];
  const nativeDirs = ["build/Release", "build/Debug", "prebuilds/darwin-arm64", "prebuilds/darwin-x64"];
  const packagedDirs = appDirs
    .flatMap((appDir) => nativeDirs.map((dir) => join(resourcesDir, appDir, "node_modules", "node-pty", dir)))
    .filter((dir) => existsSync(join(dir, "pty.node")));

  if (packagedDirs.length === 0) {
    throw new Error(`No macOS node-pty binary was packaged in ${resourcesDir}`);
  }

  for (const dir of packagedDirs) {
    const helper = join(dir, "spawn-helper");
    const entry = await stat(helper);
    if (!entry.isFile()) throw new Error(`Expected a node-pty executable at ${helper}`);

    // node-pty's macOS prebuild can ship without the execute bits.
    const mode = entry.mode & 0o777;
    const executableMode = mode | 0o111;
    if (mode !== executableMode) await chmod(helper, executableMode);
    await access(helper, constants.X_OK);
  }
}

export default { afterPack: fixMacosPtyPermissions };
