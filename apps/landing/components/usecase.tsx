"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/lib/use-language";

export function UseCase() {
  const { t } = useLanguage();

  return (
    <section id="usecase" className="bg-muted/50 px-4 py-20">
      <div className="container mx-auto">
        <h2 className="mb-4 text-center text-3xl font-bold md:text-4xl">{t.usecase.title}</h2>
        <p className="text-muted-foreground mx-auto mb-16 max-w-2xl text-center">{t.usecase.description}</p>
        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-6 md:grid-cols-2">
          {t.usecase.items.map((usecase) => (
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
