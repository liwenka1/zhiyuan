/**
 * 设置行容器
 */

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
  return (
    <div className="flex items-start justify-between gap-6 py-4">
      <div className="min-w-0 flex-1">
        <div className="text-foreground text-sm font-medium">{label}</div>
        {description && <div className="text-muted-foreground mt-0.5 text-xs">{description}</div>}
      </div>
      <div className="flex w-[320px] max-w-full shrink-0 justify-end">{children}</div>
    </div>
  );
}
