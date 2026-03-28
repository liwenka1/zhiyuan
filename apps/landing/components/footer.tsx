import type { TranslationKey } from "@/lib/i18n";

interface FooterProps {
  t: TranslationKey["footer"];
  brandName: string;
}

export function Footer({ t, brandName }: FooterProps) {
  return (
    <footer className="border-t px-4 py-12">
      <div className="container mx-auto">
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <div>
            <div className="text-foreground text-sm font-medium">{brandName}</div>
            <div className="text-muted-foreground mt-1 text-sm">{t.tagline}</div>
            <div className="text-muted-foreground mt-1 text-sm">{t.copyright}</div>
          </div>
          <div className="flex gap-6">
            {t.links.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground hover:text-foreground text-sm transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
