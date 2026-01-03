import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="px-4 pt-32 pb-20">
      <div className="container mx-auto text-center">
        <h1 className="mb-6 text-5xl font-bold tracking-tight md:text-7xl">纸鸢笔记</h1>
        <p className="text-muted-foreground mx-auto mb-10 max-w-2xl text-lg md:text-xl">
          优雅的 Markdown 编辑器，让写作更专注
        </p>
        <div className="flex items-center justify-center gap-4">
          <Button size="lg" asChild>
            <a href="#download">立即下载</a>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <a href="#features">了解更多</a>
          </Button>
        </div>
      </div>
    </section>
  );
}
