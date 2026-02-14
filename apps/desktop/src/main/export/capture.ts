import type { NativeImage } from "electron";
import * as fs from "fs/promises";
import * as path from "path";
import { tmpdir } from "os";
import { BrowserWindow } from "electron";
import { embedLocalImages } from "./assets";

async function waitForPageLoad(webContents: Electron.WebContents, timeoutMs = 10000): Promise<void> {
  const startTime = Date.now();

  const checkLoadComplete = async (): Promise<boolean> => {
    try {
      const isComplete = await webContents.executeJavaScript(`
        (function() {
          if (document.readyState !== 'complete') {
            return false;
          }

          const images = Array.from(document.images);
          const allImagesLoaded = images.every(img => img.complete && img.naturalHeight !== 0);
          if (!allImagesLoaded) {
            return false;
          }

          const videos = Array.from(document.querySelectorAll('video'));
          const allVideosReady = videos.every(video => video.readyState >= 2);
          if (!allVideosReady) {
            return false;
          }

          return true;
        })();
      `);

      return isComplete;
    } catch {
      return false;
    }
  };

  while (Date.now() - startTime < timeoutMs) {
    if (await checkLoadComplete()) {
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

export async function captureHtmlAsImage(htmlContent: string, notePath?: string, width = 800): Promise<NativeImage> {
  let window: BrowserWindow | null = null;
  let tempHtmlPath: string | null = null;

  const DOM_READY_TIMEOUT = 30000;
  const EXECUTE_JS_TIMEOUT = 10000;
  const CAPTURE_TIMEOUT = 30000;

  try {
    const processedHtml = await embedLocalImages(htmlContent, notePath);

    tempHtmlPath = path.join(tmpdir(), `export-${Date.now()}.html`);
    await fs.writeFile(tempHtmlPath, processedHtml, "utf-8");

    window = new BrowserWindow({
      width,
      height: 600,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    const domReadyPromise = new Promise<void>((resolve) => {
      window!.webContents.once("dom-ready", () => resolve());
    });

    window.loadFile(tempHtmlPath);
    await withTimeout(domReadyPromise, DOM_READY_TIMEOUT, `DOM 加载超时 (${DOM_READY_TIMEOUT}ms)`);

    await waitForPageLoad(window.webContents);

    const contentHeight = await withTimeout(
      window.webContents.executeJavaScript(
        "Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)"
      ),
      EXECUTE_JS_TIMEOUT,
      `获取页面高度超时 (${EXECUTE_JS_TIMEOUT}ms)`
    );

    window.setContentSize(width, contentHeight);

    await new Promise<void>((resolve) => {
      const timeout = setTimeout(resolve, 1000);
      window!.once("resize", () => {
        clearTimeout(timeout);
        setTimeout(resolve, 50);
      });
    });

    return await withTimeout(window.webContents.capturePage(), CAPTURE_TIMEOUT, `页面截图超时 (${CAPTURE_TIMEOUT}ms)`);
  } finally {
    if (window && !window.isDestroyed()) {
      window.close();
    }
    if (tempHtmlPath) {
      await fs.unlink(tempHtmlPath).catch(() => {});
    }
  }
}
