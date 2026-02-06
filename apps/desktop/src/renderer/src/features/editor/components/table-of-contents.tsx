import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { extractHeadings } from "@/lib/heading-extractor";
import { useActiveHeading, useTocScroll } from "../hooks";

interface TableOfContentsProps {
  content: string;
  noteId?: string;
  onItemClick?: () => void;
}

/**
 * 目录组件
 * - 从 Markdown 内容提取标题
 * - 渲染层级目录
 * - 点击跳转到对应标题
 */
export function TableOfContents({ content, noteId }: TableOfContentsProps) {
  const { t } = useTranslation("editor");

  // 1. 提取标题
  const headings = useMemo(() => extractHeadings(content), [content]);

  // 2. 标题高亮同步
  const { activeId, setActiveId, skipNextUpdate } = useActiveHeading(headings, noteId);

  // 3. 目录滚动同步
  const { tocItemRefs, handleClick } = useTocScroll(activeId, setActiveId, skipNextUpdate, noteId);

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
