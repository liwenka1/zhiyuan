import { AppWindowMock } from "@/components/app-window-mock";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { TranslationKey } from "@/lib/i18n";

interface ProductPreviewProps {
  t: TranslationKey["preview"];
}

export function ProductPreview({ t }: ProductPreviewProps) {
  return (
    <section id="workflow" className="px-4 py-20 md:py-24">
      <div className="container mx-auto grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
        <div className="max-w-xl">
          <div className="text-muted-foreground mb-4 inline-flex text-xs font-medium tracking-[0.18em] uppercase">
            {t.eyebrow}
          </div>
          <h2 className="text-3xl font-semibold tracking-tight md:text-5xl">{t.title}</h2>
          <p className="text-muted-foreground mt-5 text-lg leading-8">{t.description}</p>
          <AppWindowMock mode="capture" className="mt-8" />
        </div>
        <div className="grid gap-4">
          {t.bullets.map((bullet, index) => (
            <Card key={bullet.title} size="sm" className="border-border/60 bg-background shadow-none">
              <CardHeader className="border-b">
                <div className="text-primary text-xs font-semibold tracking-[0.16em] uppercase">0{index + 1}</div>
                <CardTitle>{bullet.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="leading-7">{bullet.description}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}