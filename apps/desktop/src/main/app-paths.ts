import { app } from "electron";
import fs from "node:fs";
import path from "node:path";

function setDirectory(name: Parameters<typeof app.setPath>[0], directory: string): void {
  fs.mkdirSync(directory, { recursive: true });
  app.setPath(name, directory);
}

function configureIsolatedProfile(root: string): void {
  setDirectory("userData", path.join(root, "profile"));
  setDirectory("sessionData", path.join(root, "session"));
  setDirectory("logs", path.join(root, "logs"));
}

// Configure paths before electron-store initializes or the app takes its single-instance lock.
if (process.env.ZHIYUAN_SMOKE_TEST === "1") {
  const root = process.env.ZHIYUAN_SMOKE_USER_DATA;
  if (!root || !path.isAbsolute(root)) throw new Error("Desktop smoke requires an isolated user-data directory");
  setDirectory("appData", path.join(root, "config"));
  configureIsolatedProfile(root);
} else if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
  configureIsolatedProfile(path.join(app.getPath("appData"), `${app.name}-dev`));
}
