import { constants, existsSync } from "node:fs";
import { access, chmod, copyFile, mkdir, readdir, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const { Arch } = require("electron-builder");

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

async function copyKoffiBinding({ appOutDir, arch, electronPlatformName, packager }) {
  const resources = packager.getResourcesDir(appOutDir);
  const platform = electronPlatformName === "mas" ? "darwin" : electronPlatformName;
  const packagedBinding = join(resources, "koffi.node");
  if (arch === Arch.universal) {
    // Both intermediate apps place their Mach-O binding at this path for electron-builder to merge.
    await access(packagedBinding, constants.R_OK);
    return;
  }

  const cpu = arch === Arch.armv7l ? "arm" : Arch[arch];
  const requireKoffi = createRequire(require.resolve("koffi"));
  const source = dirname(requireKoffi.resolve(`@koromix/koffi-${platform}-${cpu}`));
  if (platform !== "linux") {
    await copyFile(join(source, `${platform}_${cpu}`, "koffi.node"), packagedBinding);
    return;
  }

  // Keep the Linux loader's glibc and musl directory names for the selected architecture.
  const triplets = (await readdir(source)).filter((name) => existsSync(join(source, name, "koffi.node")));
  if (triplets.length === 0) throw new Error(`No Koffi bindings in ${source}`);
  for (const triplet of triplets) {
    const destination = join(resources, "koffi", triplet);
    await mkdir(destination, { recursive: true });
    await copyFile(join(source, triplet, "koffi.node"), join(destination, "koffi.node"));
  }
}

export default {
  async afterPack(context) {
    await fixMacosPtyPermissions(context);
    await copyKoffiBinding(context);
  }
};
