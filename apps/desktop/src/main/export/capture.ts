import type { NativeImage } from "electron";
import * as fs from "fs/promises";
import * as path from "path";
import { tmpdir } from "os";
import { BrowserWindow, session } from "electron";
import { pathToFileURL } from "node:url";
import { embedExportAssets, embedLocalImages } from "./assets";
import type { ExportResourceReview } from "./resource-review";
import type { WorkspacePathScope } from "../security/path-validator";
import { requireNative } from "../native/koffi";
import { layoutClipboardEquations, type ClipboardEquationSource } from "./clipboard-equation-layout";

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

function createOfflineExportWindow(
  documentUrl: string,
  width: number,
  height: number,
  { imageFiles = new Set<string>(), offscreen = false }: { imageFiles?: ReadonlySet<string>; offscreen?: boolean } = {}
) {
  getExportSession();
  const window = new BrowserWindow({
    width,
    height,
    show: false,
    transparent: offscreen,
    enableLargerThanScreen: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      partition: EXPORT_PARTITION,
      offscreen,
      backgroundThrottling: !offscreen
    }
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

let mathStyles: string | undefined;

async function loadMathStyles(): Promise<string> {
  if (mathStyles) return mathStyles;
  const stylesheet = requireNative.resolve("katex/dist/katex.min.css");
  const css = await fs.readFile(stylesheet, "utf8");
  const fonts = [...new Set(css.match(/fonts\/KaTeX_[\w-]+\.woff2/g))];
  const urls = new Map(
    await Promise.all(
      fonts.map(async (font) => {
        const data = await fs.readFile(path.join(path.dirname(stylesheet), font));
        return [font, `data:font/woff2;base64,${data.toString("base64")}`] as const;
      })
    )
  );
  mathStyles = css.replace(/fonts\/KaTeX_[\w-]+\.woff2/g, (font) => urls.get(font) ?? font);
  return mathStyles;
}

interface ClipboardEquation {
  url: string;
  width: number;
  height: number;
}

export async function captureClipboardEquations(
  formulas: ClipboardEquationSource[],
  assertCurrent: () => void,
  signal?: AbortSignal
): Promise<Map<ClipboardEquationSource, ClipboardEquation>> {
  assertCurrent();
  signal?.throwIfAborted();
  const width = 800;
  const height = 600;
  const deadline = performance.now() + 15_000;
  const withinDeadline = <T>(promise: Promise<T>, message: string) =>
    withTimeout(promise, deadline - performance.now(), message, signal);
  const images = new Map<ClipboardEquationSource, ClipboardEquation>();
  let capture: ReturnType<typeof createOfflineExportWindow> | undefined;
  try {
    const styles = await withinDeadline(loadMathStyles(), "Equation fonts failed to load");
    assertCurrent();
    capture = createOfflineExportWindow("about:blank", width, height, { offscreen: true });
    const { webContents } = capture.window;
    await withinDeadline(capture.window.loadURL("about:blank"), "Equation renderer failed to load");
    webContents.startPainting();
    await withinDeadline(
      webContents.executeJavaScript(`(() => {
        const policy = document.createElement('meta');
        policy.httpEquiv = 'Content-Security-Policy';
        policy.content = "default-src 'none'; style-src 'unsafe-inline'; font-src data:";
        document.head.append(policy);
        const style = document.createElement('style');
        style.textContent = ${JSON.stringify(styles)} + 'body{margin:0}';
        document.head.append(style);
      })()`),
      "Equation renderer stopped responding"
    );
    webContents.debugger.attach("1.3");
    // Some native importers use the PNG's pixel dimensions as its display size.
    await withinDeadline(
      webContents.debugger.sendCommand("Emulation.setDeviceMetricsOverride", {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: false
      }),
      "Equation renderer stopped responding"
    );
    await withinDeadline(
      webContents.debugger.sendCommand("Emulation.setDefaultBackgroundColorOverride", {
        color: { r: 0, g: 0, b: 0, a: 0 }
      }),
      "Equation renderer stopped responding"
    );
    for (let offset = 0; offset < formulas.length && performance.now() < deadline; offset += 32) {
      assertCurrent();
      const batch = formulas.slice(offset, offset + 32);
      const clips = await withinDeadline<Electron.Rectangle[]>(
        webContents.executeJavaScript(`(${layoutClipboardEquations.toString()})(${JSON.stringify(batch)})`),
        "Equation layout stopped responding"
      );
      for (const [index, clip] of clips.entries()) {
        if (performance.now() >= deadline) break;
        assertCurrent();
        const scale = Math.min(1, 4096 / clip.width, 4096 / clip.height);
        const displayWidth = Math.round(clip.width * scale);
        const displayHeight = Math.round(clip.height * scale);
        if (!displayWidth || !displayHeight) continue;
        const snapshot = await withinDeadline(
          webContents.debugger.sendCommand("Page.captureScreenshot", {
            format: "png",
            clip: { ...clip, scale },
            captureBeyondViewport: true
          }),
          "Equation capture stopped responding"
        ).catch(() => undefined);
        signal?.throwIfAborted();
        if (!snapshot?.data) continue;
        images.set(batch[index], {
          url: `data:image/png;base64,${snapshot.data}`,
          width: displayWidth,
          height: displayHeight
        });
      }
    }
  } catch (error) {
    if (error instanceof Error && error.message === "USER_CANCELLED") throw error;
    // The clipboard can still use captured images and the source of the remaining equations.
  } finally {
    capture?.dispose();
  }
  signal?.throwIfAborted();
  return images;
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

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string,
  signal?: AbortSignal
): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  let abort: (() => void) | undefined;

  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
    if (signal) {
      abort = () => reject(signal.reason);
      if (signal.aborted) abort();
      else signal.addEventListener("abort", abort, { once: true });
    }
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
    if (abort) signal?.removeEventListener("abort", abort);
  });
}

export async function validateExportImages(images: string[], signal?: AbortSignal): Promise<boolean[]> {
  signal?.throwIfAborted();
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
    signal?.throwIfAborted();
    decoder = createOfflineExportWindow(documentUrl, 1, 1, { imageFiles });
    const { window } = decoder;
    await withTimeout(window.loadURL(documentUrl), deadline - Date.now(), "Image decoder failed to start", signal);
    let nextImage = 0;
    async function decodeImages(): Promise<void> {
      while (nextImage < images.length) {
        const remaining = deadline - Date.now();
        if (remaining <= 0 || signal?.aborted) return;
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
            "Image decoding timed out",
            signal
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
  signal?.throwIfAborted();
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
      ? await embedExportAssets(htmlContent, review.assets, review.includeExternal, review.missingLabel)
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
