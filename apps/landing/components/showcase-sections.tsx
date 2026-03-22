import { AppWindowMock } from "@/components/app-window-mock";
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
            <div key={item.title} className={`grid items-center gap-10 lg:grid-cols-2 ${reverse ? "" : ""}`}>
              <div className={reverse ? "lg:order-2" : ""}>
                <div className="bg-muted text-muted-foreground mb-4 inline-flex rounded-full px-3 py-1 text-xs font-medium tracking-[0.18em] uppercase">
                  {item.eyebrow}
                </div>
                <h3 className="max-w-xl text-3xl font-semibold tracking-tight md:text-5xl">{item.title}</h3>
                <p className="text-muted-foreground mt-5 max-w-xl text-lg leading-8">{item.description}</p>
              </div>
              <div className={reverse ? "lg:order-1" : ""}>
                <AppWindowMock mode={mode} className="shadow-lg shadow-primary/5" />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}