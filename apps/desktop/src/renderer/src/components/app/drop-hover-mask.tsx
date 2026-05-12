import { cn } from "@/lib/utils";

interface DropHoverMaskProps {
  visible: boolean;
  topPx?: number;
  bottomGapPx?: number;
  className?: string;
}

/**
 * 通用的"拖入提示"遮罩。
 *
 * 这个组件本身不负责定位 / 跟随面板，调用方需要确保它被渲染在某个
 * `position: relative` 的容器里：遮罩使用 `inset-x-0 + top/bottom`
 * 把自己撑满该容器，从而天然地随容器一起移动 / 缩放。
 */
export function DropHoverMask({ visible, topPx = 0, bottomGapPx = 8, className }: DropHoverMaskProps) {
  if (!visible) return null;

  return (
    <div
      className={cn("bg-accent/30 pointer-events-none absolute inset-x-0 z-10000", className)}
      style={{
        top: `${topPx}px`,
        bottom: `${bottomGapPx}px`
      }}
      aria-hidden
    />
  );
}
