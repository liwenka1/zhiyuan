import { Logo } from "@/components/icons";
import type { TranslationKey } from "@/lib/i18n";

interface FooterProps {
  t: TranslationKey["footer"];
  brandName: string;
}

export function Footer({ t, brandName }: FooterProps) {
  return (
    <footer className="border-t px-4 py-10 md:py-12">
      <div className="container mx-auto max-w-4xl">
        <div className="flex flex-col items-center gap-3 text-center">
          <a href="#top" aria-label={brandName} className="flex items-center gap-3">
            <Logo className="text-foreground size-7" />
            <span className="text-foreground text-sm font-medium tracking-tight">{brandName}</span>
          </a>
          <p className="text-muted-foreground text-sm">{t.tagline}</p>
          <p className="text-muted-foreground text-sm">
            {t.maintainer.prefix}{" "}
            <a
              href={t.maintainer.href}
              target="_blank"
              rel="noreferrer"
              className="text-foreground hover:text-primary transition-colors"
            >
              {t.maintainer.name}
            </a>
            {t.maintainer.suffix ? <> {t.maintainer.suffix}</> : null}
          </p>
          <p className="text-muted-foreground/85 text-xs">{t.copyright}</p>
        </div>
      </div>
    </footer>
  );
}
