import { ArrowUpRight, FolderOpen, Keyboard, MousePointer2 } from "lucide-react";
import { Reveal } from "@/components/reveal";
import type { TranslationKey } from "@/lib/i18n";

interface DesktopDetailsProps {
  t: TranslationKey["desktopDetails"];
}

const icons = [MousePointer2, ArrowUpRight, Keyboard, FolderOpen] as const;

export function DesktopDetails({ t }: DesktopDetailsProps) {
  return (
    <section className="px-4 py-20">
      <div className="container mx-auto max-w-6xl">
        <Reveal className="mx-auto max-w-3xl text-center">
          <div className="text-primary mb-4 inline-flex text-xs font-semibold tracking-[0.18em] uppercase">
            {t.eyebrow}
          </div>
          <h2 className="text-3xl font-semibold tracking-tight md:text-5xl">{t.title}</h2>
          <p className="text-muted-foreground mt-4 mb-14 text-lg leading-8">{t.description}</p>
        </Reveal>

        <div className="grid gap-4 md:grid-cols-2">
          {t.items.map((item, index) => {
            const Icon = icons[index] ?? FolderOpen;

            return (
              <Reveal
                key={item.title}
                delay={index * 70}
                className="border-border/60 bg-card/45 rounded-3xl border p-6 md:p-7"
              >
                <div className="bg-muted text-foreground flex size-11 items-center justify-center rounded-2xl">
                  <Icon className="size-5" />
                </div>
                <h3 className="mt-4 text-xl font-semibold tracking-tight md:text-2xl">{item.title}</h3>
                <p className="text-muted-foreground mt-3 leading-7">{item.description}</p>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
