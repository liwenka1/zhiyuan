import Image from "next/image";
import { cn } from "@/lib/utils";

interface ThemeScreenshotProps {
  alt: string;
  className?: string;
  priority?: boolean;
}

export function ThemeScreenshot({ alt, className, priority = false }: ThemeScreenshotProps) {
  return (
    <div
      className={cn(
        "bg-background relative overflow-hidden rounded-sm shadow-xs md:rounded-[1.25rem]",
        "after:border-border/60 after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:border after:content-['']",
        className
      )}
    >
      <div className="aspect-2560/1053 w-full overflow-hidden">
        <Image
          src="/screenshot-light.png"
          alt={alt}
          width={2560}
          height={1504}
          priority={priority}
          unoptimized
          className="block h-auto w-full [clip-path:inset(1px)] dark:hidden"
        />
        <Image
          src="/screenshot-dark.png"
          alt={alt}
          width={2560}
          height={1504}
          priority={priority}
          unoptimized
          className="hidden h-auto w-full [clip-path:inset(1px)] dark:block"
        />
      </div>
    </div>
  );
}
