import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { TranslationKey } from "@/lib/i18n";

interface FeaturesProps {
  t: TranslationKey["features"];
}

export function Features({ t }: FeaturesProps) {
  return (
    <section id="features" className="px-4 py-20">
      <div className="container mx-auto">
        <h2 className="mb-4 text-center text-3xl font-bold md:text-4xl">{t.title}</h2>
        <p className="text-muted-foreground mx-auto mb-16 max-w-2xl text-center">{t.description}</p>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {t.items.map((feature) => (
            <Card key={feature.title}>
              <CardHeader>
                <CardTitle>{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>{feature.description}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
