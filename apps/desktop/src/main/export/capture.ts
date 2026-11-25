import type { NativeImage } from "electron";
import * as fs from "fs/promises";
import * as path from "path";
import { tmpdir } from "os";
import { BrowserWindow, session } from "electron";
import { pathToFileURL } from "node:url";
import { embedExportImages, embedLocalImages } from "./assets";
import type { ExportResourceReview } from "./resource-review";
import type { WorkspacePathScope } from "../security/path-validator";

const EXPORT_PARTITION = "export-capture";
let exportSession: Electron.Session | null = null;
const exportDocuments = new Map<number, { url: string; imageFiles: ReadonlySet<string> }>();

function getExportSession(): Electron.Session {
  if (exportSession) return exportSession;
  exportSession = session.fromPartition(EXPORT_PARTITION);
  exportSession.webRequest.onBeforeRequest({ urls: ["<all_urls>"] }, (details, callback) => {
    const ownDocument = details.webContentsId === undefined ? undefined : exportDocuments.get(details.webContentsId);
    const isOwnDocument = details.resourceType === "mainFrame" && details.url === ownDocument?.url;
    const isReviewedImage = details.resourceType === "image" && ownDocument?.imageFiles.has(details.url);
    callback({
      cancel: !isOwnDocument && !isReviewedImage && !details.url.startsWith("data:") && details.url !== "about:blank"
    });
  });
  return exportSession;
}

function createOfflineExportWindow(documentUrl: string, width: number, height: number, imageFiles = new Set<string>()) {
  getExportSession();
  const window = new BrowserWindow({
    width,
    height,
    show: false,
    enableLargerThanScreen: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, partition: EXPORT_PARTITION }
  });
  const windowId = window.webContents.id;
  exportDocuments.set(windowId, { url: documentUrl, imageFiles });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, url) => {
    if (url !== documentUrl) event.preventDefault();
  });

  return {
    window,
    dispose() {
      exportDocuments.delete(windowId);
      if (!window.isDestroyed()) window.destroy();
    }
  };
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

export async function validateExportImages(images: string[]): Promise<boolean[]> {
  const valid = Array<boolean>(images.length).fill(false);
  if (!images.length) return valid;

  const imageFiles = new Set(images.filter((source) => source.startsWith("file:")));
  const deadline = Date.now() + 8_000;
  let decoder: ReturnType<typeof createOfflineExportWindow> | undefined;
  let tempDirectory: string | undefined;
  try {
    let documentUrl = "about:blank";
    if (imageFiles.size) {
      tempDirectory = await fs.mkdtemp(path.join(tmpdir(), "zhiyuan-image-review-"));
      const documentPath = path.join(tempDirectory, "index.html");
      await fs.writeFile(
        documentPath,
        '<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data: file:">'
      );
      documentUrl = pathToFileURL(documentPath).href;
    }
    decoder = createOfflineExportWindow(documentUrl, 1, 1, imageFiles);
    const { window } = decoder;
    await withTimeout(window.loadURL(documentUrl), deadline - Date.now(), "Image decoder failed to start");
    let nextImage = 0;
    async function decodeImages(): Promise<void> {
      while (nextImage < images.length) {
        const remaining = deadline - Date.now();
        if (remaining <= 0) return;
        const index = nextImage++;
        try {
          const decoded = await withTimeout(
            window.webContents.executeJavaScript(`(async () => {
              const image = new Image();
              image.src = ${JSON.stringify(images[index])};
              await image.decode();
              return image.naturalWidth > 0 && image.naturalHeight > 0;
            })()`),
            remaining,
            "Image decoding timed out"
          );
          valid[index] = decoded === true;
        } catch {
          // A failed or stalled decode only affects its own image.
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(images.length, 4) }, decodeImages));
  } catch {
    // A stopped decoder leaves the remaining images unavailable for this export.
  } finally {
    try {
      decoder?.dispose();
    } finally {
      if (tempDirectory) await fs.rm(tempDirectory, { recursive: true, force: true }).catch(() => {});
    }
  }
  return valid;
}

export async function captureHtmlAsImage(
  htmlContent: string,
  notePath?: string,
  width = 800,
  workspace?: string | WorkspacePathScope,
  review?: ExportResourceReview
): Promise<NativeImage> {
  let capture: ReturnType<typeof createOfflineExportWindow> | undefined;
  let tempDirectory: string | null = null;

  const DOM_READY_TIMEOUT = 30000;
  const EXECUTE_JS_TIMEOUT = 10000;
  const CAPTURE_TIMEOUT = 30000;

  try {
    const processedHtml = review
      ? await embedExportImages(htmlContent, review.assets, review.includeExternal, review.missingLabel)
      : await embedLocalImages(htmlContent, notePath, workspace);

    tempDirectory = await fs.mkdtemp(path.join(tmpdir(), "zhiyuan-export-"));
    const tempHtmlPath = path.join(tempDirectory, "index.html");
    const documentUrl = pathToFileURL(tempHtmlPath).href;
    await fs.writeFile(tempHtmlPath, processedHtml, "utf-8");

    capture = createOfflineExportWindow(documentUrl, width, 600);
    const { window } = capture;

    await withTimeout(window.loadURL(documentUrl), DOM_READY_TIMEOUT, `页面加载超时 (${DOM_READY_TIMEOUT}ms)`);

    await waitForPageLoad(window.webContents);

    const brokenImages: string[] = await withTimeout(
      window.webContents.executeJavaScript(`Array.from(document.images).flatMap((image, index) =>
        image.getAttribute('src')?.trim() && !image.naturalWidth ? [image.alt || image.title || String(index + 1)] : []
      )`),
      EXECUTE_JS_TIMEOUT,
      "Export images stopped responding"
    );
    if (brokenImages.length) throw new Error(`Could not render export images: ${brokenImages.join(", ")}`);

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
    try {
      capture?.dispose();
    } finally {
      if (tempDirectory) {
        await fs.rm(tempDirectory, { recursive: true, force: true }).catch(() => {});
      }
    }
  }
}
