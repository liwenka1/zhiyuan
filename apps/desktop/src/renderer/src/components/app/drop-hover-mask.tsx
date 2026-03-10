import { cn } from "@/lib/utils";

interface DropHoverMaskProps {
  visible: boolean;
  left?: number;
  width?: number;
  topPx?: number;
  bottomGapPx?: number;
  className?: string;
}

export function DropHoverMask({ visible, left, width, topPx = 0, bottomGapPx = 8, className }: DropHoverMaskProps) {
  if (!visible) return null;

  return (
    <div
      className={cn("bg-accent/30 pointer-events-none absolute z-10000", className)}
      style={{
        left: left !== undefined ? `${left}px` : "0px",
        right: width === undefined ? "0px" : undefined,
        top: `${topPx}px`,
        width: width !== undefined ? `${width}px` : undefined,
        bottom: `${bottomGapPx}px`
      }}
      aria-hidden
    />
  );
}
