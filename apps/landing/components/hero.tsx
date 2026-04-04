import { ArrowRight } from "lucide-react";
import { Reveal } from "@/components/reveal";
import { ThemeScreenshot } from "@/components/theme-screenshot";
import { buttonVariants } from "@/components/ui/button";
import type { TranslationKey } from "@/lib/i18n";

interface HeroProps {
  t: TranslationKey["hero"];
}

export function Hero({ t }: HeroProps) {
  return (
    <section className="relative overflow-hidden px-4 pt-16 pb-12 md:pt-20 md:pb-18">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-112 bg-[radial-gradient(circle_at_top,rgba(0,115,230,0.08),transparent_60%)] dark:bg-[radial-gradient(circle_at_top,rgba(0,140,255,0.12),transparent_60%)]" />
      <div className="relative container mx-auto max-w-6xl">
        <Reveal className="mx-auto max-w-5xl text-center">
          <div className="text-primary border-border/70 bg-background/85 inline-flex rounded-full border px-4 py-1.5 text-xs font-semibold tracking-[0.2em] uppercase backdrop-blur-sm">
            {t.eyebrow}
          </div>
          <h1 className="mx-auto mt-6 max-w-5xl text-[clamp(3.2rem,8vw,6.4rem)] leading-[0.94] font-semibold tracking-tight">
            {t.title}
          </h1>
          <p className="text-muted-foreground mx-auto mt-6 max-w-3xl text-base leading-7 md:text-xl md:leading-9">
            {t.description}
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            {t.highlights.map((item) => (
              <span
                key={item}
                className="border-border/70 bg-background/80 text-foreground/85 rounded-full border px-3.5 py-1.5 text-sm backdrop-blur-sm"
              >
                {item}
              </span>
            ))}
          </div>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
            <a
              href="https://github.com/liwenka1/zhiyuan"
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ size: "lg" })}
            >
              {t.download}
              <ArrowRight className="size-4" />
            </a>
            <a href="#features" className={buttonVariants({ size: "lg", variant: "outline" })}>
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
