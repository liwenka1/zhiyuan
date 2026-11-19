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
      className={`bg-muted/30 flex-col flex-nowrap items-stretch gap-2 rounded-md @lg:flex-row @lg:gap-4 ${hasDescription ? "@lg:items-start" : "@lg:items-center"}`}
    >
      <ItemContent className={`min-w-0 ${hasDescription ? "" : "gap-0"}`}>
        <ItemTitle className="text-foreground">{label}</ItemTitle>
        {description ? (
          <ItemDescription className="mt-0.5 line-clamp-none text-xs leading-snug">{description}</ItemDescription>
        ) : null}
      </ItemContent>
      <ItemActions
        className={`w-full max-w-full shrink-0 @lg:w-[min(360px,45%)] @lg:justify-end ${hasDescription ? "@lg:self-start" : "@lg:self-center"}`}
      >
        {children}
      </ItemActions>
    </Item>
  );
}
