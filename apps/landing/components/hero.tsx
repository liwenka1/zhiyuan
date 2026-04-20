import { Github } from "lucide-react";
import { Reveal } from "@/components/reveal";
import { ThemeScreenshot } from "@/components/theme-screenshot";
import { buttonVariants } from "@/components/ui/button";
import type { TranslationKey } from "@/lib/i18n";

interface HeroProps {
  t: TranslationKey["hero"];
}

export function Hero({ t }: HeroProps) {
  return (
    <section className="relative overflow-hidden px-4 pt-12 pb-10 md:pt-16 md:pb-16">
      <div className="relative container mx-auto max-w-6xl">
        <Reveal className="mx-auto max-w-4xl text-center">
          <div className="text-primary border-border/70 bg-background/85 inline-flex rounded-full border px-4 py-1.5 text-xs font-semibold tracking-[0.2em] uppercase backdrop-blur-sm">
            {t.eyebrow}
          </div>
          <h1 className="mx-auto mt-5 max-w-4xl text-6xl leading-none font-semibold tracking-tight">{t.title}</h1>
          <p className="text-muted-foreground mx-auto mt-5 max-w-2xl text-base leading-7 md:text-xl md:leading-8">
            {t.description}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a
              href="https://github.com/liwenka1/zhiyuan"
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ size: "lg" })}
            >
              <Github className="size-4" />
              {t.download}
            </a>
            <a href="#workflow" className={buttonVariants({ size: "lg", variant: "outline" })}>
              {t.learnMore}
            </a>
          </div>
        </Reveal>
        <Reveal className="relative mx-auto mt-12 max-w-6xl" delay={120}>
          <ThemeScreenshot alt="Zhiyuan desktop screenshot" priority />
        </Reveal>
      </div>
    </section>
  );
}
