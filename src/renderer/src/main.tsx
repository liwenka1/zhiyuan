import './assets/main.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createRouter, createRootRoute, createRoute, createHashHistory } from '@tanstack/react-router'
import App from './App'

// Root route
const rootRoute = createRootRoute({
  component: App,
})

// Index route
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => (
    <div className="flex flex-col items-center justify-center h-full space-y-4">
      <h1 className="text-2xl font-bold">Welcome to Electron + Shadcn + TanStack Router</h1>
      <p className="text-muted-foreground">This is the home page.</p>
    </div>
  ),
})

// About route
const aboutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/about',
  component: () => (
    <div className="flex flex-col items-center justify-center h-full">
      <h1 className="text-xl font-bold">About</h1>
      <p>This is a demonstration of TanStack Router with HashHistory.</p>
    </div>
  ),
})

const routeTree = rootRoute.addChildren([indexRoute, aboutRoute])

const router = createRouter({
  routeTree,
  history: createHashHistory(),
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
)
