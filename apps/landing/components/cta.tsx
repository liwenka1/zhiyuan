

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLanguage } from "@/lib/use-language";

export function CTA() {
  const { t } = useLanguage();

  return (
    <section id="download" className="px-4 py-20">
      <div className="container mx-auto max-w-4xl">
        <Card className="bg-primary text-primary-foreground">
          <CardContent className="p-12 text-center">
            <h2 className="mb-4 text-3xl font-bold md:text-4xl">{t.cta.title}</h2>
            <p className="mb-10 text-lg opacity-90">{t.cta.description}</p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Button size="lg" variant="secondary" asChild>
                <a href="#">{t.cta.windows}</a>
              </Button>
              <Button size="lg" variant="secondary" asChild>
                <a href="#">{t.cta.macos}</a>
              </Button>
              <Button size="lg" variant="secondary" asChild>
                <a href="#">{t.cta.linux}</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
