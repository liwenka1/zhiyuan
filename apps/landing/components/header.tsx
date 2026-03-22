import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { HeaderShell } from "@/components/header-shell";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import type { Language, TranslationKey } from "@/lib/i18n";

interface HeaderProps {
  language: Language;
  t: TranslationKey;
}

export function Header({ language, t }: HeaderProps) {
  return (
    <HeaderShell>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-6">
        <div className="min-w-0 flex items-center gap-3">
          <Link href={language === "en" ? "/en" : "/"} className="flex items-center gap-3">
            <span className="text-lg font-semibold tracking-tight md:text-xl">{t.brand.name}</span>
          </Link>
        </div>
        <div className="flex items-center gap-1.5 md:gap-2">
          <a
            href={t.brand.githubUrl}
            target="_blank"
            rel="noreferrer"
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            {t.header.download}
          </a>
          <LanguageToggle language={language} />
          <ThemeToggle />
        </div>
      </div>
    </HeaderShell>
  );
}
