import "./assets/main.css";
import "./lib/i18n";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { enableMapSet } from "immer";
import App from "./App";

function reportRendererError(source: string, error: unknown): void {
  try {
    const normalized = error instanceof Error ? error : new Error(String(error));
    window.api.diagnostics.reportError({
      source,
      message: normalized.message,
      ...(normalized.stack ? { stack: normalized.stack } : {})
    });
  } catch {
    // 错误上报本身不能阻塞应用启动。
  }
}

window.addEventListener("error", (event) => {
  reportRendererError("window.error", event.error ?? event.message);
});

window.addEventListener("unhandledrejection", (event) => {
  reportRendererError("window.unhandledrejection", event.reason);
});

// 启用 Immer 的 Map 和 Set 支持
enableMapSet();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
