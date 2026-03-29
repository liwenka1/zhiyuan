import { FileText, Monitor, Workflow } from "lucide-react";
import { Reveal } from "@/components/reveal";
import type { TranslationKey } from "@/lib/i18n";

interface ProofGridProps {
  t: TranslationKey["proof"];
}

const icons = [Workflow, FileText, Monitor] as const;

export function ProofGrid({ t }: ProofGridProps) {
  return (
    <section className="px-4 py-8 md:py-10">
      <div className="container mx-auto max-w-6xl">
        <Reveal className="border-border/60 grid gap-10 border-y py-10 md:grid-cols-[0.9fr_1.1fr] md:py-12">
          <div className="max-w-xl">
            <div className="text-primary text-xs font-semibold tracking-[0.18em] uppercase">{t.eyebrow}</div>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight md:text-5xl">{t.title}</h2>
          </div>
          <p className="text-muted-foreground max-w-2xl text-base leading-7 md:pt-1 md:text-lg md:leading-8">
            {t.description}
          </p>
        </Reveal>

        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {t.items.map((item, index) => {
            const Icon = icons[index] ?? Workflow;

            return (
              <Reveal
                key={item.title}
                delay={index * 80}
                className="border-border/60 bg-card/55 rounded-3xl border p-6 backdrop-blur-sm"
              >
                <div className="bg-muted text-foreground flex size-11 items-center justify-center rounded-2xl">
                  <Icon className="size-5" />
                </div>
                <h3 className="mt-5 text-xl font-semibold tracking-tight">{item.title}</h3>
                <p className="text-muted-foreground mt-3 leading-7">{item.description}</p>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
