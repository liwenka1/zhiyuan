import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { TranslationKey } from "@/lib/i18n";

interface UseCaseProps {
  t: TranslationKey["usecase"];
}

export function UseCase({ t }: UseCaseProps) {
  return (
    <section id="usecase" className="px-4 py-20">
      <div className="container mx-auto">
        <h2 className="mx-auto max-w-3xl text-center text-3xl font-semibold tracking-tight md:text-5xl">{t.title}</h2>
        <p className="text-muted-foreground mx-auto mt-4 mb-14 max-w-2xl text-center text-lg leading-8">{t.description}</p>
        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-6 md:grid-cols-2">
          {t.items.map((usecase, index) => (
            <Card key={usecase.title} className="border-border/60 bg-background shadow-none">
              <CardHeader>
                <div className="text-primary text-xs font-semibold tracking-[0.18em] uppercase">Use case 0{index + 1}</div>
                <CardTitle>{usecase.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="leading-7">{usecase.description}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
