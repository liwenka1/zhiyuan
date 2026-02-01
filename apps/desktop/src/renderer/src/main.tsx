import "./assets/main.css";
import "./lib/i18n";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { enableMapSet } from "immer";
import App from "./App";

// 启用 Immer 的 Map 和 Set 支持
enableMapSet();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
