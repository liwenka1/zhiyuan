import { Outlet, Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'

function App(): React.JSX.Element {
  const ipcHandle = (): void => window.electron.ipcRenderer.send('ping')

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <nav className="flex items-center justify-between border-b p-4">
        <div className="flex gap-4">
          <Button asChild variant="ghost">
            <Link to="/" activeProps={{ className: 'text-primary bg-accent' }}>
              Home
            </Link>
          </Button>
          <Button asChild variant="ghost">
            <Link to="/about" activeProps={{ className: 'text-primary bg-accent' }}>
              About
            </Link>
          </Button>
        </div>
        <Button onClick={ipcHandle} variant="outline" size="sm">
          Ping IPC
        </Button>
      </nav>
      <main className="flex-1 overflow-auto p-4">
        <Outlet />
      </main>
    </div>
  )
}

export default App
