import { useEffect, type RefObject } from "react";

/**
 * 阻止 wheel 事件冒泡到外层 ScrollArea，防止控件交互时弹窗跟着滚动。
 * 使用原生 addEventListener + { passive: false } 才能真正 preventDefault。
 */
export function usePreventWheelScroll(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const handler = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
    };

    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [ref]);
}
