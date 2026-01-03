import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function CTA() {
  return (
    <section id="download" className="px-4 py-20">
      <div className="container mx-auto max-w-4xl">
        <Card className="bg-primary text-primary-foreground">
          <CardContent className="p-12 text-center">
            <h2 className="mb-4 text-3xl font-bold md:text-4xl">开始使用纸鸢笔记</h2>
            <p className="mb-10 text-lg opacity-90">选择适合你的平台，立即下载体验</p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Button size="lg" variant="secondary" asChild>
                <a href="#">Windows</a>
              </Button>
              <Button size="lg" variant="secondary" asChild>
                <a href="#">macOS</a>
              </Button>
              <Button size="lg" variant="secondary" asChild>
                <a href="#">Linux</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
