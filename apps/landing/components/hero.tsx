

import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/use-language";

export function Hero() {
  const { t } = useLanguage();

  return (
    <section className="px-4 pt-32 pb-20">
      <div className="container mx-auto text-center">
        <h1 className="mb-6 text-5xl font-bold tracking-tight md:text-7xl">{t.hero.title}</h1>
        <p className="text-muted-foreground mx-auto mb-10 max-w-2xl text-lg md:text-xl">{t.hero.description}</p>
        <div className="flex items-center justify-center gap-4">
          <Button size="lg" asChild>
            <a href="#download">{t.hero.download}</a>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <a href="#features">{t.hero.learnMore}</a>
          </Button>
        </div>
      </div>
    </section>
  );
}
