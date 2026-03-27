import { FileDown, Keyboard, Link2, MonitorSmartphone, Rss, ScanText } from "lucide-react";
import { Reveal } from "@/components/reveal";
import type { TranslationKey } from "@/lib/i18n";

interface FeaturesProps {
  t: TranslationKey["features"];
}

const icons = [Rss, Link2, ScanText, MonitorSmartphone, FileDown, Keyboard] as const;

export function Features({ t }: FeaturesProps) {
  return (
    <section id="features" className="px-4 py-20">
      <div className="container mx-auto">
        <Reveal className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight md:text-5xl">{t.title}</h2>
          <p className="text-muted-foreground mt-4 mb-14 text-lg leading-8">{t.description}</p>
        </Reveal>
        <div className="mx-auto grid max-w-6xl gap-x-10 md:grid-cols-2 xl:grid-cols-3">
          {t.items.map((feature, index) => (
            <Reveal key={feature.title} delay={index * 50} className="border-border/60 border-t py-6">
              <div className="bg-muted text-foreground flex size-10 items-center justify-center rounded-2xl">
                {(() => {
                  const Icon = icons[index] ?? ScanText;
                  return <Icon className="size-5" />;
                })()}
              </div>
              <h3 className="mt-4 text-xl font-semibold tracking-tight">{feature.title}</h3>
              <p className="text-muted-foreground mt-3 leading-7">{feature.description}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
