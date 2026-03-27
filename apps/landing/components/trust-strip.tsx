import { Reveal } from "@/components/reveal";
import type { TranslationKey } from "@/lib/i18n";

interface TrustStripProps {
  t: TranslationKey["trust"];
}

export function TrustStrip({ t }: TrustStripProps) {
  return (
    <section className="px-4 pb-10 md:pb-14">
      <Reveal className="border-border/60 container mx-auto border-y py-5">
        <div className="text-muted-foreground mb-4 text-center text-sm">{t.title}</div>
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          {t.items.map((item) => (
            <span key={item} className="text-foreground/80 text-sm font-medium tracking-[0.18em] uppercase">
              {item}
            </span>
          ))}
        </div>
      </Reveal>
    </section>
  );
}
