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
          <div className="text-foreground text-sm font-semibold tracking-wide">{title}</div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
        {description && <div className="text-muted-foreground mt-1 text-xs leading-relaxed">{description}</div>}
      </div>

      {notice && (
        <div className="bg-muted/50 text-muted-foreground border-border mb-3 rounded-md border px-3 py-2 text-xs">
          {notice}
        </div>
      )}

      <div className="space-y-2">{children}</div>
    </section>
  );
}
