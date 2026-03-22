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
        <Card className="border-border/60 bg-background shadow-none">
          <CardContent className="p-8 text-center md:p-12">
            <h2 className="mx-auto max-w-3xl text-3xl font-semibold tracking-tight md:text-5xl">{t.title}</h2>
            <p className="text-muted-foreground mx-auto mt-4 max-w-2xl text-lg leading-8">{t.description}</p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              {t.links.map((link, index) => (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  className={
                    index === 0
                      ? buttonVariants({ size: "lg", variant: "secondary" })
                      : buttonVariants({ size: "lg", variant: "outline" })
                  }
                >
                  {link.label}
                </a>
              ))}
            </div>
            <div className="text-muted-foreground mt-8 flex flex-wrap items-center justify-center gap-3 text-sm">
              {t.platforms.map((platform) => (
                <span key={platform} className="rounded-full border border-border/60 px-3 py-1.5">
                  {platform}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
