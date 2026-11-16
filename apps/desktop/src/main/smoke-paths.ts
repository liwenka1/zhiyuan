import { app } from "electron";
import fs from "node:fs";
import path from "node:path";

// This side effect must run before electron-store or any other user-data consumer.
if (process.env.ZHIYUAN_SMOKE_TEST === "1") {
  const root = process.env.ZHIYUAN_SMOKE_USER_DATA;
  if (!root || !path.isAbsolute(root)) throw new Error("Desktop smoke requires an isolated user-data directory");
  for (const [name, directory] of [
    ["appData", path.join(root, "config")],
    ["userData", path.join(root, "profile")],
    ["sessionData", path.join(root, "session")],
    ["logs", path.join(root, "logs")]
  ] as const) {
    fs.mkdirSync(directory, { recursive: true });
    app.setPath(name, directory);
  }
}
