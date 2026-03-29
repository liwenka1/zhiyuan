import { Github } from "lucide-react";
import { Logo } from "@/components/icons";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { HeaderShell } from "@/components/header-shell";
import { buttonVariants } from "@/components/ui/button";
import type { Language, TranslationKey } from "@/lib/i18n";

interface HeaderProps {
  language: Language;
  t: TranslationKey;
}

export function Header({ language, t }: HeaderProps) {
  return (
    <HeaderShell>
      <div className="mx-auto grid h-16 max-w-6xl grid-cols-[1fr_auto] items-center gap-4 px-4 md:grid-cols-[1fr_auto_1fr] md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <a href="#top" aria-label={t.brand.name} className="flex items-center">
            <Logo className="text-foreground size-8" />
          </a>
        </div>
        <nav className="hidden items-center justify-center gap-6 md:flex">
          <a href="#workflow" className="text-muted-foreground hover:text-foreground text-sm transition-colors">
            {t.header.workflow}
          </a>
          <a href="#features" className="text-muted-foreground hover:text-foreground text-sm transition-colors">
            {t.header.features}
          </a>
          <a href="#usecase" className="text-muted-foreground hover:text-foreground text-sm transition-colors">
            {t.header.usecase}
          </a>
        </nav>
        <div className="flex items-center gap-1.5 justify-self-end md:gap-2">
          <a
            href={t.brand.githubUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={t.header.download}
            className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
          >
            <Github className="size-4" />
            <span className="sr-only">{t.header.download}</span>
          </a>
          <LanguageToggle language={language} />
          <ThemeToggle />
        </div>
      </div>
    </HeaderShell>
  );
}
