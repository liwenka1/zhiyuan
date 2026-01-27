import { useState, useEffect, useRef, useCallback } from "react";
import { TocItem } from "@/lib/heading-extractor";

export interface UseActiveHeadingReturn {
  activeId: string | null;
  setActiveId: (id: string | null) => void;
  skipNextUpdate: () => void;
}

/**
 * 监听预览区域的滚动，自动高亮当前可见的标题
 * @param headings 标题列表
 */
export function useActiveHeading(headings: TocItem[]): UseActiveHeadingReturn {
  const [activeId, setActiveId] = useState<string | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const headingElementsRef = useRef<Map<string, IntersectionObserverEntry>>(new Map());
  const skipUpdateRef = useRef(false);

  // 跳过下一次更新（用于点击跳转时）
  const skipNextUpdate = useCallback(() => {
    skipUpdateRef.current = true;
  }, []);

  // 设置 Intersection Observer 监听标题滚动
  useEffect(() => {
    if (headings.length === 0) return;

    const previewScrollArea = document.getElementById("preview-scroll-area");
    if (!previewScrollArea) return;

    const scrollContainer = previewScrollArea.querySelector('[data-slot="scroll-area-viewport"]');
    if (!scrollContainer) return;

    // 初始化：立即检查并高亮第一个可见标题
    const checkInitialHeading = () => {
      const containerRect = scrollContainer.getBoundingClientRect();

      for (const heading of headings) {
        const element = document.getElementById(heading.id);
        if (element) {
          const rect = element.getBoundingClientRect();
          // 找到第一个在视口内的标题
          if (rect.top >= containerRect.top && rect.top < containerRect.bottom) {
            setActiveId(heading.id);
            break;
          }
        }
      }
    };

    // 使用 rAF 确保 DOM 已经渲染完成
    const rafId = requestAnimationFrame(() => {
      requestAnimationFrame(checkInitialHeading);
    });

    // 清理之前的 observer
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    // 创建 Intersection Observer
    observerRef.current = new IntersectionObserver(
      (entries) => {
        // 如果标记为跳过更新，则跳过这次更新
        if (skipUpdateRef.current) {
          return;
        }

        // 更新每个标题的可见性状态
        entries.forEach((entry) => {
          if (entry.target.id) {
            headingElementsRef.current.set(entry.target.id, entry);
          }
        });

        // 找出所有可见的标题
        const visibleHeadings = Array.from(headingElementsRef.current.values())
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => {
            // 按照在文档中的位置排序（越靠上越优先）
            return a.target.getBoundingClientRect().top - b.target.getBoundingClientRect().top;
          });

        // 高亮最靠近视口顶部的可见标题
        if (visibleHeadings.length > 0) {
          const topHeading = visibleHeadings[0];
          setActiveId(topHeading.target.id);
        } else {
          // 如果没有可见标题，检查是否滚动到底部
          // 如果是，保持最后一个标题高亮
          const allHeadings = Array.from(headingElementsRef.current.values());
          if (allHeadings.length > 0) {
            const lastHeading = allHeadings[allHeadings.length - 1];
            const rect = lastHeading.target.getBoundingClientRect();
            const containerRect = scrollContainer.getBoundingClientRect();

            // 如果最后一个标题在视口上方，说明滚动到了底部空白区域
            if (rect.bottom < containerRect.top) {
              setActiveId(lastHeading.target.id);
            }
          }
        }
      },
      {
        root: scrollContainer,
        // 标题进入视口即可见，底部留 50% 缓冲区避免频繁切换
        rootMargin: "0px 0px -50% 0px",
        threshold: 0
      }
    );

    // 监听所有标题元素
    headings.forEach((heading) => {
      const element = document.getElementById(heading.id);
      if (element && observerRef.current) {
        observerRef.current.observe(element);
      }
    });

    // 保存 ref 的当前值供 cleanup 函数使用
    const currentHeadingElements = headingElementsRef.current;

    // 清理函数
    return () => {
      cancelAnimationFrame(rafId);
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
      currentHeadingElements.clear();
    };
  }, [headings]);

  return { activeId, setActiveId, skipNextUpdate };
}
