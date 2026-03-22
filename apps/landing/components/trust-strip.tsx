import type { TranslationKey } from "@/lib/i18n";

interface TrustStripProps {
  t: TranslationKey["trust"];
}

export function TrustStrip({ t }: TrustStripProps) {
  return (
    <section className="px-4 pb-10 md:pb-14">
      <div className="container mx-auto">
        <div className="text-muted-foreground mb-5 text-center text-sm">{t.title}</div>
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          {t.items.map((item) => (
            <span key={item} className="text-foreground/80 text-sm font-medium tracking-[0.18em] uppercase">
              {item}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}