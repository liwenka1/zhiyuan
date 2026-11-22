import type { NativeImage } from "electron";
import * as fs from "fs/promises";
import * as path from "path";
import { tmpdir } from "os";
import { BrowserWindow, session } from "electron";
import { pathToFileURL } from "node:url";
import { embedLocalImages } from "./assets";
import { embedLocalCssImages } from "./css-assets";

const EXPORT_PARTITION = "export-capture";
let exportSession: Electron.Session | null = null;
const exportMainDocuments = new Map<number, string>();

function getExportSession(): Electron.Session {
  if (exportSession) return exportSession;
  exportSession = session.fromPartition(EXPORT_PARTITION);
  exportSession.webRequest.onBeforeRequest({ urls: ["<all_urls>"] }, (details, callback) => {
    const ownDocument =
      details.webContentsId === undefined ? undefined : exportMainDocuments.get(details.webContentsId);
    const isOwnDocument = details.resourceType === "mainFrame" && details.url === ownDocument;
    // All local subresources must have been workspace-validated and embedded first.
    callback({ cancel: !isOwnDocument && !details.url.startsWith("data:") && details.url !== "about:blank" });
  });
  return exportSession;
}

function stripRemoteMediaSources(html: string): string {
  return html.replace(/<(img|video|audio|source)\b[^>]*>/gi, (tag) =>
    tag.replace(/\s(?:src|poster)\s*=\s*(["'])(?:https?:|\/\/)[^"']*\1/gi, "")
  );
}

async function waitForPageLoad(webContents: Electron.WebContents, timeoutMs = 10000): Promise<void> {
  const startTime = Date.now();

  const checkLoadComplete = async (): Promise<boolean> => {
    return await webContents.executeJavaScript(`
        (function() {
          if (document.readyState !== 'complete') {
            return false;
          }

          const images = Array.from(document.images);
          for (const image of images) {
            if (image.loading === 'lazy') image.loading = 'eager';
          }
          const allImagesLoaded = images.every(img => img.complete);
          if (!allImagesLoaded) {
            return false;
          }

          const videos = Array.from(document.querySelectorAll('video'));
          const allVideosReady = videos.every(video => !video.currentSrc || video.readyState >= 2);
          if (!allVideosReady || document.fonts.status !== 'loaded') {
            return false;
          }

          return true;
        })();
      `);
  };

  while (Date.now() - startTime < timeoutMs) {
    if (
      await withTimeout(checkLoadComplete(), timeoutMs - (Date.now() - startTime), "Export page stopped responding")
    ) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  let timeoutId: NodeJS.Timeout;

  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
}

export async function captureHtmlAsImage(
  htmlContent: string,
  notePath?: string,
  width = 800,
  workspacePath?: string
): Promise<NativeImage> {
  let window: BrowserWindow | null = null;
  let windowId: number | null = null;
  let tempDirectory: string | null = null;

  const DOM_READY_TIMEOUT = 30000;
  const EXECUTE_JS_TIMEOUT = 10000;
  const CAPTURE_TIMEOUT = 30000;

  try {
    const processedHtml = stripRemoteMediaSources(
      await embedLocalCssImages(await embedLocalImages(htmlContent, notePath, workspacePath), notePath, workspacePath)
    );

    tempDirectory = await fs.mkdtemp(path.join(tmpdir(), "zhiyuan-export-"));
    const tempHtmlPath = path.join(tempDirectory, "index.html");
    const documentUrl = pathToFileURL(tempHtmlPath).href;
    await fs.writeFile(tempHtmlPath, processedHtml, "utf-8");

    getExportSession();
    window = new BrowserWindow({
      width,
      height: 600,
      show: false,
      enableLargerThanScreen: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        partition: EXPORT_PARTITION
      }
    });
    windowId = window.webContents.id;
    exportMainDocuments.set(windowId, documentUrl);
    window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    window.webContents.on("will-navigate", (event, url) => {
      if (url !== documentUrl) event.preventDefault();
    });

    await withTimeout(window.loadURL(documentUrl), DOM_READY_TIMEOUT, `页面加载超时 (${DOM_READY_TIMEOUT}ms)`);

    await waitForPageLoad(window.webContents);

    const contentHeight = await withTimeout(
      window.webContents.executeJavaScript(
        "Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)"
      ),
      EXECUTE_JS_TIMEOUT,
      `获取页面高度超时 (${EXECUTE_JS_TIMEOUT}ms)`
    );

    const captureWindow = window;
    await new Promise<void>((resolve) => {
      const onResize = () => {
        clearTimeout(timeout);
        setTimeout(resolve, 50);
      };
      const timeout = setTimeout(() => {
        captureWindow.removeListener("resize", onResize);
        resolve();
      }, 1000);
      captureWindow.once("resize", onResize);
      captureWindow.setContentSize(width, contentHeight);
    });

    return await withTimeout(window.webContents.capturePage(), CAPTURE_TIMEOUT, `页面截图超时 (${CAPTURE_TIMEOUT}ms)`);
  } finally {
    if (windowId !== null) exportMainDocuments.delete(windowId);
    try {
      if (window && !window.isDestroyed()) window.destroy();
    } finally {
      if (tempDirectory) {
        await fs.rm(tempDirectory, { recursive: true, force: true }).catch(() => {});
      }
    }
  }
}
