export function Footer() {
  return (
    <footer className="border-t px-4 py-12">
      <div className="container mx-auto">
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <div className="text-muted-foreground text-sm">© 2025 纸鸢笔记. All rights reserved.</div>
          <div className="flex gap-6">
            <a href="#" className="text-muted-foreground hover:text-foreground text-sm transition-colors">
              GitHub
            </a>
            <a href="#" className="text-muted-foreground hover:text-foreground text-sm transition-colors">
              文档
            </a>
            <a href="#" className="text-muted-foreground hover:text-foreground text-sm transition-colors">
              反馈
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
