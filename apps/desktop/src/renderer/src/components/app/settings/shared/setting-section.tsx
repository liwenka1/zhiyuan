/**
 * 设置分组容器
 */
export function SettingSection({
  title,
  description,
  notice,
  action,
  children
}: {
  title: string;
  description?: string;
  notice?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-5">
      <div className="mb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-semibold tracking-wide text-foreground">{title}</div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
        {description && <div className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</div>}
      </div>

      {notice && (
        <div className="mb-3 rounded-md border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          {notice}
        </div>
      )}

      <div className="space-y-2">{children}</div>
    </section>
  );
}
