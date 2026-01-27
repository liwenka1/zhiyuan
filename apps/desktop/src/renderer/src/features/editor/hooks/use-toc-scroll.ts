import { useEffect, useRef, useCallback } from "react";

export interface UseTocScrollReturn {
  tocItemRefs: React.MutableRefObject<Map<string, HTMLButtonElement>>;
  handleClick: (id: string) => void;
}

/**
 * 处理目录的滚动同步
 * - 自动滚动目录到活跃项
 * - 点击目录项跳转到对应标题
 * @param activeId 当前活跃的标题 ID
 * @param setActiveId 设置活跃标题的函数
 * @param skipNextUpdate 跳过下一次高亮更新的函数
 */
export function useTocScroll(
  activeId: string | null,
  setActiveId: (id: string | null) => void,
  skipNextUpdate: () => void
): UseTocScrollReturn {
  const tocItemRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const isClickScrollingRef = useRef(false);

  // 当 activeId 变化时，滚动目录到可见位置
  useEffect(() => {
    if (!activeId) return;

    // 如果是点击触发的滚动，跳过自动滚动目录
    if (isClickScrollingRef.current) return;

    const tocItem = tocItemRefs.current.get(activeId);
    if (!tocItem) return;

    // 找到目录的 ScrollArea viewport
    const tocScrollArea = tocItem.closest('[data-slot="scroll-area"]');
    if (!tocScrollArea) return;

    const tocScrollContainer = tocScrollArea.querySelector('[data-slot="scroll-area-viewport"]');
    if (!tocScrollContainer) return;

    // 获取目录项和容器的位置信息
    const containerRect = tocScrollContainer.getBoundingClientRect();
    const itemRect = tocItem.getBoundingClientRect();

    // 检查目录项是否在可见范围内
    const isVisible = itemRect.top >= containerRect.top && itemRect.bottom <= containerRect.bottom;

    if (!isVisible) {
      // 计算滚动位置，让目录项居中显示
      const scrollTop = tocScrollContainer.scrollTop;
      const offset = itemRect.top - containerRect.top + scrollTop - containerRect.height / 2 + itemRect.height / 2;

      // 平滑滚动
      tocScrollContainer.scrollTo({
        top: offset,
        behavior: "smooth"
      });
    }
  }, [activeId]);

  // 点击目录项跳转到对应标题
  const handleClick = useCallback(
    (id: string) => {
      // 标记为点击触发的滚动，跳过后续的高亮更新
      isClickScrollingRef.current = true;
      skipNextUpdate();

      // 立即设置选中状态
      setActiveId(id);

      // 查找预览区域的目标元素
      const element = document.getElementById(id);
      if (!element) {
        isClickScrollingRef.current = false;
        return;
      }

      // 查找预览区域的 ScrollArea 容器
      const previewScrollArea = document.getElementById("preview-scroll-area");
      if (!previewScrollArea) {
        isClickScrollingRef.current = false;
        return;
      }

      // 查找 ScrollArea 的实际滚动容器（Radix UI 的 Viewport）
      const scrollContainer = previewScrollArea.querySelector('[data-slot="scroll-area-viewport"]');

      if (scrollContainer) {
        // 计算元素相对于滚动容器的位置
        const containerRect = scrollContainer.getBoundingClientRect();
        const elementRect = element.getBoundingClientRect();
        const scrollTop = scrollContainer.scrollTop;
        const offset = elementRect.top - containerRect.top + scrollTop - 20; // 20px 顶部偏移

        // 平滑滚动到目标位置
        scrollContainer.scrollTo({
          top: offset,
          behavior: "smooth"
        });

        // 监听滚动结束事件
        let fallbackTimer: number | null = null;

        const handleScrollEnd = () => {
          // 滚动结束后，恢复高亮更新
          isClickScrollingRef.current = false;
          if (fallbackTimer !== null) {
            clearTimeout(fallbackTimer);
          }
        };

        // 优先使用 scrollend 事件（现代浏览器支持）
        scrollContainer.addEventListener("scrollend", handleScrollEnd, { once: true });

        // 降级方案：如果 scrollend 不支持或超时，使用定时器
        fallbackTimer = window.setTimeout(() => {
          if (isClickScrollingRef.current) {
            isClickScrollingRef.current = false;
            scrollContainer.removeEventListener("scrollend", handleScrollEnd);
          }
        }, 1000);
      } else {
        // 降级方案：使用标准的 scrollIntoView
        element.scrollIntoView({ behavior: "smooth", block: "start" });

        // 使用定时器作为降级方案
        setTimeout(() => {
          isClickScrollingRef.current = false;
        }, 1000);
      }
    },
    [setActiveId, skipNextUpdate]
  );

  return { tocItemRefs, handleClick };
}
