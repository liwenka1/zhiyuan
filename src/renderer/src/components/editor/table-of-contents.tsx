import { useMemo, useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import GithubSlugger from "github-slugger";

interface TocItem {
  id: string;
  text: string;
  level: number;
}

interface TableOfContentsProps {
  content: string;
  onItemClick?: () => void;
}

/**
 * 从 Markdown 内容中提取标题
 * 跳过代码块、引用块、HTML 注释中的标题
 * 使用 github-slugger 生成 ID（与 rehype-slug 完全一致）
 */
function extractHeadings(markdown: string): TocItem[] {
  const headings: TocItem[] = [];
  const lines = markdown.split("\n");
  const slugger = new GithubSlugger();

  let inCodeBlock = false;
  let inHtmlComment = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // 检测 HTML 注释
    if (trimmedLine.includes("<!--")) {
      inHtmlComment = true;
    }
    if (trimmedLine.includes("-->")) {
      inHtmlComment = false;
      continue;
    }
    if (inHtmlComment) {
      continue;
    }

    // 检测代码块（围栏式代码块 ``` 或缩进式代码块）
    if (trimmedLine.startsWith("```") || trimmedLine.startsWith("~~~")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }

    // 如果在代码块内，跳过
    if (inCodeBlock) {
      continue;
    }

    // 跳过缩进代码块（4个空格或1个tab开头）
    if (line.match(/^( {4}|\t)/)) {
      continue;
    }

    // 跳过引用块中的标题（> 开头）
    if (trimmedLine.startsWith(">")) {
      continue;
    }

    // 匹配 # 标题语法（必须在行首）
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const text = match[2].trim();
      // 使用 github-slugger 生成 ID，与 rehype-slug 完全一致
      const id = slugger.slug(text);

      // 只添加有效的标题（有 ID）
      if (id) {
        headings.push({ id, text, level });
      }
    }
  }

  return headings;
}

/**
 * 目录组件
 * - 从 Markdown 内容提取标题
 * - 渲染层级目录
 * - 点击跳转到对应标题
 */
export function TableOfContents({ content }: TableOfContentsProps) {
  const { t } = useTranslation("editor");
  const [activeId, setActiveId] = useState<string | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const headingElementsRef = useRef<Map<string, IntersectionObserverEntry>>(new Map());
  const tocItemRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const isClickScrollingRef = useRef(false); // 标记是否正在进行点击触发的滚动

  const headings = useMemo(() => extractHeadings(content), [content]);

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
        // 如果正在进行点击触发的滚动，不更新 activeId（避免一个一个标题走过去）
        if (isClickScrollingRef.current) {
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

  const handleClick = (id: string) => {
    // 标记为点击触发的滚动
    isClickScrollingRef.current = true;

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
  };

  if (headings.length === 0) {
    return <div className="text-muted-foreground py-4 text-center text-sm">{t("toc.empty")}</div>;
  }

  return (
    <ScrollArea className="h-[400px]">
      <nav className="space-y-0.5 pr-3">
        {headings.map((heading, index) => {
          const isActive = activeId === heading.id;
          return (
            <button
              key={`${heading.id}-${index}`}
              ref={(el) => {
                if (el) {
                  tocItemRefs.current.set(heading.id, el);
                } else {
                  tocItemRefs.current.delete(heading.id);
                }
              }}
              onClick={() => handleClick(heading.id)}
              className={cn(
                "w-full cursor-pointer overflow-hidden rounded-md px-3 py-2 text-left transition-colors duration-200",
                isActive ? "bg-accent/50 text-foreground hover:bg-accent/60" : "text-foreground/90 hover:bg-accent/30"
              )}
              style={{
                paddingLeft: `${(heading.level - 1) * 0.75 + 0.75}rem`
              }}
            >
              <span className="block truncate text-sm font-medium">{heading.text}</span>
            </button>
          );
        })}
      </nav>
    </ScrollArea>
  );
}
