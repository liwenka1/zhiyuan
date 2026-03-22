import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { TranslationKey } from "@/lib/i18n";

interface CTAProps {
  t: TranslationKey["cta"];
}

export function CTA({ t }: CTAProps) {
  return (
    <section id="download" className="px-4 py-20">
      <div className="container mx-auto max-w-4xl">
        <Card className="bg-primary text-primary-foreground">
          <CardContent className="p-12 text-center">
            <h2 className="mb-4 text-3xl font-bold md:text-4xl">{t.title}</h2>
            <p className="mb-10 text-lg opacity-90">{t.description}</p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <a href="#" className={buttonVariants({ size: "lg", variant: "secondary" })}>
                {t.windows}
              </a>
              <a href="#" className={buttonVariants({ size: "lg", variant: "secondary" })}>
                {t.macos}
              </a>
              <a href="#" className={buttonVariants({ size: "lg", variant: "secondary" })}>
                {t.linux}
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
