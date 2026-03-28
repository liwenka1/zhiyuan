import { Reveal } from "@/components/reveal";
import type { TranslationKey } from "@/lib/i18n";

interface ProductPreviewProps {
  t: TranslationKey["preview"];
}

export function ProductPreview({ t }: ProductPreviewProps) {
  return (
    <section id="workflow" className="px-4 py-18 md:py-24">
      <div className="container mx-auto max-w-6xl">
        <Reveal className="mx-auto max-w-3xl text-center">
          <div className="text-primary mb-4 inline-flex text-xs font-semibold tracking-[0.18em] uppercase">
            {t.eyebrow}
          </div>
          <h2 className="text-3xl font-semibold tracking-tight md:text-5xl">{t.title}</h2>
          <p className="text-muted-foreground mt-5 text-lg leading-8">{t.description}</p>
        </Reveal>
        <div className="mt-12 grid gap-6 lg:grid-cols-[0.78fr_1.22fr] lg:gap-10">
          <Reveal className="rounded-[1.75rem] border border-border/60 bg-card/55 p-7 md:p-8" delay={80}>
            <div className="text-primary text-xs font-semibold tracking-[0.16em] uppercase">{t.sideLabel}</div>
            <p className="mt-5 text-2xl leading-tight font-semibold tracking-tight md:text-3xl">{t.sideTitle}</p>
            <p className="text-muted-foreground mt-5 text-base leading-7 md:text-lg md:leading-8">{t.sideDescription}</p>
          </Reveal>
          <div className="grid gap-4">
            {t.bullets.map((bullet, index) => (
              <Reveal
                key={bullet.title}
                delay={140 + index * 80}
                className="grid gap-5 rounded-[1.5rem] border border-border/60 bg-background p-6 md:grid-cols-[auto_1fr] md:items-start"
              >
                <div className="text-primary flex size-12 items-center justify-center rounded-2xl bg-muted text-sm font-semibold">
                  0{index + 1}
                </div>
                <div>
                  <h3 className="text-xl font-semibold tracking-tight md:text-2xl">{bullet.title}</h3>
                  <p className="text-muted-foreground mt-3 leading-7">{bullet.description}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
