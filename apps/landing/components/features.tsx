import { FileDown, Keyboard, Link2, MonitorSmartphone, Rss, ScanText } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { TranslationKey } from "@/lib/i18n";

interface FeaturesProps {
  t: TranslationKey["features"];
}

const icons = [Rss, Link2, ScanText, MonitorSmartphone, FileDown, Keyboard] as const;

export function Features({ t }: FeaturesProps) {
  return (
    <section id="features" className="px-4 py-20">
      <div className="container mx-auto">
        <h2 className="mx-auto max-w-3xl text-center text-3xl font-semibold tracking-tight md:text-5xl">{t.title}</h2>
        <p className="text-muted-foreground mx-auto mt-4 mb-14 max-w-2xl text-center text-lg leading-8">{t.description}</p>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {t.items.map((feature, index) => (
            <Card key={feature.title} className="border-border/60 bg-background min-h-56 shadow-none">
              <CardHeader>
                <div className="bg-muted text-foreground flex size-11 items-center justify-center rounded-2xl border border-border/60">
                  {(() => {
                    const Icon = icons[index] ?? ScanText;
                    return <Icon className="size-5" />;
                  })()}
                </div>
                <CardTitle>{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="leading-7">{feature.description}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
