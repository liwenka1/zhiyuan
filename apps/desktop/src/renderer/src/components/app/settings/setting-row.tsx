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
    <div className="flex items-center justify-between gap-8 py-4">
      <div className="shrink-0">
        <div className="text-foreground text-sm font-medium">{label}</div>
        {description && <div className="text-muted-foreground mt-0.5 text-xs">{description}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
