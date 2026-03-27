import { Reveal } from "@/components/reveal";
import type { TranslationKey } from "@/lib/i18n";

interface UseCaseProps {
  t: TranslationKey["usecase"];
}

export function UseCase({ t }: UseCaseProps) {
  return (
    <section id="usecase" className="px-4 py-20">
      <div className="container mx-auto">
        <Reveal className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight md:text-5xl">{t.title}</h2>
          <p className="text-muted-foreground mt-4 mb-14 text-lg leading-8">{t.description}</p>
        </Reveal>
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-x-8 md:grid-cols-2">
          {t.items.map((usecase, index) => (
            <Reveal key={usecase.title} delay={index * 70} className="border-border/60 border-t py-6">
              <div className="text-primary text-xs font-semibold tracking-[0.18em] uppercase">
                Use case 0{index + 1}
              </div>
              <h3 className="mt-3 text-2xl font-semibold tracking-tight">{usecase.title}</h3>
              <p className="text-muted-foreground mt-3 leading-7">{usecase.description}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
