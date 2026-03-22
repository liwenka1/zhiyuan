import { buttonVariants } from "@/components/ui/button";
import type { TranslationKey } from "@/lib/i18n";

interface HeroProps {
  t: TranslationKey["hero"];
}

export function Hero({ t }: HeroProps) {
  return (
    <section className="px-4 pt-32 pb-20">
      <div className="container mx-auto text-center">
        <h1 className="mb-6 text-5xl font-bold tracking-tight md:text-7xl">{t.title}</h1>
        <p className="text-muted-foreground mx-auto mb-10 max-w-2xl text-lg md:text-xl">{t.description}</p>
        <div className="flex items-center justify-center gap-4">
          <a href="#download" className={buttonVariants({ size: "lg" })}>
            {t.download}
          </a>
          <a href="#features" className={buttonVariants({ size: "lg", variant: "outline" })}>
            {t.learnMore}
          </a>
        </div>
      </div>
    </section>
  );
}
