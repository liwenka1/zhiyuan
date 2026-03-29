import { buttonVariants } from "@/components/ui/button";
import { Reveal } from "@/components/reveal";
import type { TranslationKey } from "@/lib/i18n";

interface CTAProps {
  t: TranslationKey["cta"];
}

export function CTA({ t }: CTAProps) {
  return (
    <section id="download" className="px-4 py-20">
      <Reveal className="border-border/60 bg-card/55 container mx-auto max-w-5xl rounded-[2rem] border px-6 py-12 text-center md:px-10 md:py-14">
        <div className="text-primary inline-flex text-xs font-semibold tracking-[0.18em] uppercase">{t.eyebrow}</div>
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
                index === 0 ? buttonVariants({ size: "lg" }) : buttonVariants({ size: "lg", variant: "outline" })
              }
            >
              {link.label}
            </a>
          ))}
        </div>
        <div className="text-muted-foreground mt-8 flex flex-wrap items-center justify-center gap-3 text-sm">
          {t.platforms.map((platform) => (
            <span key={platform} className="border-border/60 rounded-full border px-3 py-1.5">
              {platform}
            </span>
          ))}
        </div>
      </Reveal>
    </section>
  );
}
