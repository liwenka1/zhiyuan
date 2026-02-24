/**
 * 设置行容器
 */

import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";

/* ---------- 设置行容器 ---------- */
export function SettingRow({
  label,
  description,
  children
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  const hasDescription = Boolean(description);

  return (
    <Item
      variant="muted"
      size="sm"
      className={`bg-muted/30 flex-nowrap gap-4 rounded-md ${hasDescription ? "items-start" : "items-center"}`}
    >
      <ItemContent className={`min-w-0 ${hasDescription ? "" : "gap-0"}`}>
        <ItemTitle className="text-foreground">{label}</ItemTitle>
        {description ? (
          <ItemDescription className="mt-0.5 line-clamp-none text-xs leading-snug">{description}</ItemDescription>
        ) : null}
      </ItemContent>
      <ItemActions
        className={`w-[min(360px,45%)] max-w-full shrink-0 justify-end ${hasDescription ? "self-start" : "self-center"}`}
      >
        {children}
      </ItemActions>
    </Item>
  );
}
