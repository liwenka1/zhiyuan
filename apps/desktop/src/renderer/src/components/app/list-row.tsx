import * as React from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

interface ListRowProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  layoutId?: string;
  hovered?: boolean;
  selected?: boolean;
  muted?: boolean;
  leading?: React.ReactNode;
  label: React.ReactNode;
  description?: React.ReactNode;
  trailing?: React.ReactNode;
  align?: "center" | "start";
  descriptionFullWidth?: boolean;
  contentClassName?: string;
  leadingClassName?: string;
  labelClassName?: string;
  descriptionClassName?: string;
}

const ListRow = React.forwardRef<HTMLButtonElement, ListRowProps>(function ListRow(
  {
    className,
    layoutId,
    hovered = false,
    selected = false,
    muted = false,
    leading,
    label,
    description,
    trailing,
    align = "center",
    descriptionFullWidth = false,
    contentClassName,
    leadingClassName,
    labelClassName,
    descriptionClassName,
    type = "button",
    ...props
  },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "group relative flex w-full min-w-0 cursor-pointer appearance-none justify-start gap-2 overflow-hidden rounded-md px-3 py-2 text-left text-sm transition-colors outline-none",
        align === "start" ? "items-start" : "items-center",
        selected ? "text-foreground" : muted ? "text-muted-foreground" : "text-foreground",
        "focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        className
      )}
      {...props}
    >
      {layoutId ? (
        <motion.div
          layoutId={layoutId}
          className="bg-accent absolute inset-0 rounded-md"
          initial={false}
          animate={{ opacity: hovered ? 1 : 0 }}
          transition={{ type: "spring", stiffness: 1200, damping: 40, mass: 0.3 }}
        />
      ) : hovered ? (
        <div className="bg-accent absolute inset-0 rounded-md" />
      ) : null}
      <div className={cn("bg-accent absolute inset-0 rounded-md", selected ? "opacity-100" : "opacity-0")} />

      {descriptionFullWidth ? (
        <div className="relative z-10 flex min-w-0 flex-1 flex-col">
          <div className={cn("flex min-w-0 items-start gap-2", contentClassName)}>
            {leading ? (
              <div className={cn("flex shrink-0 items-center", align === "start" && "self-start", leadingClassName)}>
                {leading}
              </div>
            ) : null}
            <div className="min-w-0 flex-1 text-left">
              <div className={cn("truncate text-sm leading-tight", labelClassName)}>{label}</div>
            </div>
            {trailing ? <div className="shrink-0">{trailing}</div> : null}
          </div>
          {description ? <div className={cn("text-left", descriptionClassName)}>{description}</div> : null}
        </div>
      ) : (
        <>
          {leading ? (
            <div
              className={cn(
                "relative z-10 flex shrink-0 items-center",
                align === "start" && "self-start",
                leadingClassName
              )}
            >
              {leading}
            </div>
          ) : null}
          <div className={cn("relative z-10 min-w-0 flex-1 text-left", contentClassName)}>
            <div className={cn("truncate text-sm leading-tight", labelClassName)}>{label}</div>
            {description ? <div className={cn("text-left", descriptionClassName)}>{description}</div> : null}
          </div>
          {trailing ? <div className="relative z-10 shrink-0">{trailing}</div> : null}
        </>
      )}
    </button>
  );
});

ListRow.displayName = "ListRow";

export { ListRow };
