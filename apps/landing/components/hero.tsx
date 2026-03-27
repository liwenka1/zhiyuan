import { ArrowRight } from "lucide-react";
import { AppWindowMock } from "@/components/app-window-mock";
import { Reveal } from "@/components/reveal";
import { buttonVariants } from "@/components/ui/button";
import type { TranslationKey } from "@/lib/i18n";

interface HeroProps {
  t: TranslationKey["hero"];
}

export function Hero({ t }: HeroProps) {
  return (
    <section className="relative overflow-hidden px-4 pt-14 pb-16 md:pt-18 md:pb-20">
      <div className="relative container mx-auto">
        <Reveal className="mx-auto max-w-4xl text-center">
          <h1 className="mx-auto max-w-4xl text-[clamp(3rem,7vw,6rem)] leading-[0.96] font-semibold tracking-tight">
            {t.title}
          </h1>
          <p className="text-muted-foreground mx-auto mt-5 max-w-2xl text-base leading-7 md:text-lg md:leading-8">
            {t.description}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
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
          <AppWindowMock mode="reader" className="relative" />
        </Reveal>
      </div>
    </section>
  );
}
