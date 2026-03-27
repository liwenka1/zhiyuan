import { AppWindowMock } from "@/components/app-window-mock";
import { Reveal } from "@/components/reveal";
import type { TranslationKey } from "@/lib/i18n";

interface ShowcaseSectionsProps {
  t: TranslationKey["showcase"];
}

export function ShowcaseSections({ t }: ShowcaseSectionsProps) {
  return (
    <section className="px-4 py-20">
      <div className="container mx-auto space-y-20">
        {t.items.map((item, index) => {
          const reverse = index % 2 === 1;
          const mode = index === 0 ? "capture" : index === 1 ? "writer" : "reader";

          return (
            <div key={item.title} className="border-border/60 border-t pt-10">
              <div className="grid items-center gap-10 lg:grid-cols-[0.92fr_1.08fr]">
                <Reveal className={reverse ? "lg:order-2" : ""}>
                  <div className="text-primary mb-3 text-xs font-semibold tracking-[0.16em] uppercase">
                    0{index + 1}
                  </div>
                  <div className="text-muted-foreground mb-4 text-xs font-medium tracking-[0.18em] uppercase">
                    {item.eyebrow}
                  </div>
                  <h3 className="max-w-xl text-3xl font-semibold tracking-tight md:text-5xl">{item.title}</h3>
                  <p className="text-muted-foreground mt-5 max-w-xl text-lg leading-8">{item.description}</p>
                </Reveal>
                <Reveal className={reverse ? "lg:order-1" : ""} delay={100}>
                  <AppWindowMock mode={mode} />
                </Reveal>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
