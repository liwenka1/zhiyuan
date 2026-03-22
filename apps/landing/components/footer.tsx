import type { TranslationKey } from "@/lib/i18n";

interface FooterProps {
  t: TranslationKey["footer"];
}

export function Footer({ t }: FooterProps) {
  return (
    <footer className="border-t px-4 py-12">
      <div className="container mx-auto">
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <div className="text-muted-foreground text-sm">{t.copyright}</div>
          <div className="flex gap-6">
            <a href="#" className="text-muted-foreground hover:text-foreground text-sm transition-colors">
              {t.github}
            </a>
            <a href="#" className="text-muted-foreground hover:text-foreground text-sm transition-colors">
              {t.docs}
            </a>
            <a href="#" className="text-muted-foreground hover:text-foreground text-sm transition-colors">
              {t.feedback}
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
