import { Github, NotebookText, Rss } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { TranslationKey } from "@/lib/i18n";

interface ProofStripProps {
  t: TranslationKey["proof"];
}

const icons = [NotebookText, Github, Rss] as const;

export function ProofStrip({ t }: ProofStripProps) {
  return (
    <section className="px-4 py-10 md:py-14">
      <div className="container mx-auto grid gap-4 md:grid-cols-3">
        {t.items.map((item, index) => {
          const Icon = icons[index] ?? NotebookText;

          return (
            <Card key={item.title} className="border-border/60 bg-background shadow-none">
              <CardContent className="flex items-start gap-4 pt-6">
                <div className="bg-muted text-foreground flex size-11 shrink-0 items-center justify-center rounded-2xl border border-border/60">
                  <Icon className="size-5" />
                </div>
                <div>
                  <div className="text-foreground text-base font-medium">{item.title}</div>
                  <p className="text-muted-foreground mt-2 text-sm leading-7">{item.description}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}