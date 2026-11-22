import { handleAppIpc } from "../security/app-ipc";
import { importRss, updateRss, unsubscribeRss } from "../rss";
import { wrapIpcHandlerWithEvent } from "./ipc-result";
import { getCallerWorkspace } from "../security/window-context";
import { validatePathInWorkspace } from "../security/path-validator";

export function registerRssHandlers(): void {
  handleAppIpc(
    "rss:import",
    wrapIpcHandlerWithEvent(async (event, url: string, _workspacePath: string) => {
      return await importRss(url, getCallerWorkspace(event));
    }, "RSS_IMPORT_FAILED")
  );

  handleAppIpc(
    "rss:update",
    wrapIpcHandlerWithEvent(async (event, folderPath: string) => {
      const workspacePath = getCallerWorkspace(event);
      const validation = validatePathInWorkspace(workspacePath, folderPath);
      if (!validation.isValid) {
        throw new Error("RSS folder is outside workspace");
      }
      return await updateRss(validation.normalizedPath);
    }, "RSS_UPDATE_FAILED")
  );

  handleAppIpc(
    "rss:unsubscribe",
    wrapIpcHandlerWithEvent(async (event, folderPath: string) => {
      const workspacePath = getCallerWorkspace(event);
      const validation = validatePathInWorkspace(workspacePath, folderPath);
      if (!validation.isValid) {
        throw new Error("RSS folder is outside workspace");
      }
      await unsubscribeRss(validation.normalizedPath);
    }, "RSS_UNSUBSCRIBE_FAILED")
  );
}
