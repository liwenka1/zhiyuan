import Image from "next/image";
import { cn } from "@/lib/utils";

interface ThemeScreenshotProps {
  alt: string;
  className?: string;
  priority?: boolean;
}

export function ThemeScreenshot({ alt, className, priority = false }: ThemeScreenshotProps) {
  return (
    <div className={cn("border-border/60 bg-background overflow-hidden rounded-[1.75rem] border", className)}>
      <Image
        src="/screenshot-light.png"
        alt={alt}
        width={2880}
        height={1800}
        priority={priority}
        className="-mb-2.5 block h-auto w-full dark:hidden"
      />
      <Image
        src="/screenshot-dark.png"
        alt={alt}
        width={2880}
        height={1800}
        priority={priority}
        className="-mb-2.5 hidden h-auto w-full dark:block"
      />
    </div>
  );
}
