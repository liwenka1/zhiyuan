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
      <div className="aspect-2560/1053 w-full overflow-hidden">
        <Image
          src="/screenshot-light.png"
          alt={alt}
          width={2560}
          height={1504}
          priority={priority}
          unoptimized
          className="block h-auto w-full dark:hidden"
        />
        <Image
          src="/screenshot-dark.png"
          alt={alt}
          width={2560}
          height={1504}
          priority={priority}
          unoptimized
          className="hidden h-auto w-full dark:block"
        />
      </div>
    </div>
  );
}
