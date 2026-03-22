"use client";

import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface HeaderShellProps {
  children: ReactNode;
}

export function HeaderShell({ children }: HeaderShellProps) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const updateScrolled = () => {
      setScrolled(window.scrollY > 10);
    };

    updateScrolled();
    window.addEventListener("scroll", updateScrolled, { passive: true });

    return () => {
      window.removeEventListener("scroll", updateScrolled);
    };
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 transition-[background-color,border-color] duration-200",
        scrolled ? "border-b border-border/65 bg-background" : "border-b border-transparent bg-background"
      )}
    >
      {children}
    </header>
  );
}