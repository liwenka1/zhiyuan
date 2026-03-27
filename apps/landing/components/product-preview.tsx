import { AppWindowMock } from "@/components/app-window-mock";
import { Reveal } from "@/components/reveal";
import type { TranslationKey } from "@/lib/i18n";

interface ProductPreviewProps {
  t: TranslationKey["preview"];
}

export function ProductPreview({ t }: ProductPreviewProps) {
  return (
    <section id="workflow" className="px-4 py-20 md:py-24">
      <div className="container mx-auto">
        <Reveal className="mx-auto max-w-3xl text-center">
          <div className="text-muted-foreground mb-4 inline-flex text-xs font-medium tracking-[0.18em] uppercase">
            {t.eyebrow}
          </div>
          <h2 className="text-3xl font-semibold tracking-tight md:text-5xl">{t.title}</h2>
          <p className="text-muted-foreground mt-5 text-lg leading-8">{t.description}</p>
        </Reveal>
        <Reveal className="mx-auto mt-10 max-w-6xl" delay={80}>
          <AppWindowMock mode="capture" />
        </Reveal>
        <div className="border-border/60 mx-auto mt-10 grid max-w-6xl gap-8 border-t pt-8 md:grid-cols-3">
          {t.bullets.map((bullet, index) => (
            <Reveal
              key={bullet.title}
              delay={120 + index * 80}
              className="border-border/60 border-t pt-5 md:border-t-0 md:pt-0"
            >
              <div className="text-primary text-xs font-semibold tracking-[0.16em] uppercase">0{index + 1}</div>
              <h3 className="mt-3 text-xl font-semibold tracking-tight">{bullet.title}</h3>
              <p className="text-muted-foreground mt-3 leading-7">{bullet.description}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
