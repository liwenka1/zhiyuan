import { useLanguage } from "@/lib/use-language";

export function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="border-t px-4 py-12">
      <div className="container mx-auto">
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <div className="text-muted-foreground text-sm">{t.footer.copyright}</div>
          <div className="flex gap-6">
            <a href="#" className="text-muted-foreground hover:text-foreground text-sm transition-colors">
              {t.footer.github}
            </a>
            <a href="#" className="text-muted-foreground hover:text-foreground text-sm transition-colors">
              {t.footer.docs}
            </a>
            <a href="#" className="text-muted-foreground hover:text-foreground text-sm transition-colors">
              {t.footer.feedback}
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
