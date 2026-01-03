import { ThemeToggle } from "@/components/theme-toggle";

export function Header() {
  return (
    <header className="bg-background/95 supports-[backdrop-filter]:bg-background/60 fixed top-0 right-0 left-0 z-50 border-b backdrop-blur">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold">纸鸢笔记</span>
        </div>
        <nav className="hidden items-center gap-6 md:flex">
          <a href="#features" className="hover:text-primary text-sm font-medium transition-colors">
            功能
          </a>
          <a href="#usecase" className="hover:text-primary text-sm font-medium transition-colors">
            使用场景
          </a>
          <a href="#download" className="hover:text-primary text-sm font-medium transition-colors">
            下载
          </a>
        </nav>
        <ThemeToggle />
      </div>
    </header>
  );
}
