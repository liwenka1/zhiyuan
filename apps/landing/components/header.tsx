import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { useLanguage } from "@/lib/use-language";

export function Header() {
  const { t } = useLanguage();

  return (
    <header className="bg-background/95 supports-backdrop-filter:bg-background/60 fixed top-0 right-0 left-0 z-50 border-b backdrop-blur">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold">{t.hero.title}</span>
        </div>
        <nav className="hidden items-center gap-6 md:flex">
          <a href="#features" className="hover:text-primary text-sm font-medium transition-colors">
            {t.header.features}
          </a>
          <a href="#usecase" className="hover:text-primary text-sm font-medium transition-colors">
            {t.header.usecase}
          </a>
          <a href="#download" className="hover:text-primary text-sm font-medium transition-colors">
            {t.header.download}
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
