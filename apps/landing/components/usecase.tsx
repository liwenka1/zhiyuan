import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { TranslationKey } from "@/lib/i18n";

interface UseCaseProps {
  t: TranslationKey["usecase"];
}

export function UseCase({ t }: UseCaseProps) {
  return (
    <section id="usecase" className="bg-muted/50 px-4 py-20">
      <div className="container mx-auto">
        <h2 className="mb-4 text-center text-3xl font-bold md:text-4xl">{t.title}</h2>
        <p className="text-muted-foreground mx-auto mb-16 max-w-2xl text-center">{t.description}</p>
        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-6 md:grid-cols-2">
          {t.items.map((usecase) => (
            <Card key={usecase.title}>
              <CardHeader>
                <CardTitle>{usecase.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>{usecase.description}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
