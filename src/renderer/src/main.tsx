import "./assets/main.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider, createRouter, createRootRoute, createHashHistory } from "@tanstack/react-router";
import App from "./App";

// Root route
const rootRoute = createRootRoute({
  component: App
});

const routeTree = rootRoute;

const router = createRouter({
  routeTree,
  history: createHashHistory()
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
