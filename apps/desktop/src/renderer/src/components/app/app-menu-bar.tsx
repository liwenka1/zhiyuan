import { useState, useRef, useEffect, useCallback, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { windowIpc } from "@/ipc";
import { useLanguageStore } from "@/stores";
import { menuSchema, resolveLabel, isMenuItem } from "@shared";
import type { MenuAction, MenuLocale, MenuGroupDef, MenuEntryDef } from "@shared";

interface ElectronCSSProperties extends CSSProperties {
  WebkitAppRegion?: "drag" | "no-drag";
}

/* ---------- 渲染进程菜单动作映射 ---------- */

const editActions = new Set<MenuAction>(["undo", "redo", "cut", "copy", "paste", "selectAll"]);

function getActionHandler(action: MenuAction): () => void {
  if (action === "newWindow") return () => windowIpc.newWindow();
  if (action === "openFolder") return () => window.dispatchEvent(new Event("app:menu-open-folder"));
  if (action === "openFile") return () => window.dispatchEvent(new Event("app:menu-open-file"));
  if (editActions.has(action)) return () => document.execCommand(action);
  return () => {};
}

/* ---------- 菜单下拉面板 ---------- */

function MenuDropdown({ items, locale, onClose }: { items: MenuEntryDef[]; locale: MenuLocale; onClose: () => void }) {
  return (
    <div
      className="bg-popover ring-foreground/10 animate-in fade-in-0 zoom-in-95 absolute top-full left-0 z-50 min-w-[200px] rounded-md p-1 shadow-md ring-1"
      style={{ WebkitAppRegion: "no-drag" } as ElectronCSSProperties}
    >
      {items.map((entry, i) =>
        !isMenuItem(entry) ? (
          <div key={i} className="bg-border my-1 h-px" />
        ) : (
          <button
            key={entry.id}
            className="hover:bg-muted/60 flex w-full cursor-pointer items-center justify-between rounded-sm px-3 py-1.5 text-sm transition-colors"
            onClick={() => {
              getActionHandler(entry.id)();
              onClose();
            }}
          >
            <span>{resolveLabel(entry.label, locale)}</span>
            {entry.shortcut && <span className="text-muted-foreground ml-8 text-xs">{entry.shortcut.win}</span>}
          </button>
        )
      )}
    </div>
  );
}

/* ---------- 菜单按钮 ---------- */

function MenuButton({
  group,
  locale,
  isOpen,
  onOpen,
  onHover,
  onClose,
  anyOpen
}: {
  group: MenuGroupDef;
  locale: MenuLocale;
  isOpen: boolean;
  onOpen: () => void;
  onHover: () => void;
  onClose: () => void;
  anyOpen: boolean;
}) {
  return (
    <div className="relative" style={{ WebkitAppRegion: "no-drag" } as ElectronCSSProperties}>
      <button
        className={cn(
          "cursor-pointer rounded px-2.5 py-0.5 text-sm transition-colors",
          isOpen ? "bg-muted/60 text-foreground" : "text-foreground/80 hover:bg-muted/40"
        )}
        onClick={() => (isOpen ? onClose() : onOpen())}
        onMouseEnter={() => anyOpen && onHover()}
      >
        {resolveLabel(group.label, locale)}
      </button>
      {isOpen && <MenuDropdown items={group.items} locale={locale} onClose={onClose} />}
    </div>
  );
}

/* ---------- AppMenuBar 主组件 ---------- */

export function AppMenuBar() {
  const { t: tEditor } = useTranslation("editor");
  const language = useLanguageStore((s) => s.language);
  const locale = language as MenuLocale;
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  // 点击外部 / Escape 关闭
  const closeMenus = useCallback(() => setOpenIndex(null), []);

  useEffect(() => {
    if (openIndex === null) return;

    const handleClick = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        closeMenus();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenus();
    };

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [openIndex, closeMenus]);

  const barStyle: ElectronCSSProperties = {
    height: "var(--titlebar-height-windows)",
    WebkitAppRegion: "drag"
  };

  return (
    <div
      ref={barRef}
      data-titlebar
      className="bg-background fixed inset-x-0 top-0 z-9999 flex items-center"
      style={barStyle}
    >
      {/* App Name */}
      <div
        className="flex h-full shrink-0 items-center px-3"
        style={{ WebkitAppRegion: "no-drag" } as ElectronCSSProperties}
      >
        <span className="text-foreground text-sm font-medium">{tEditor("appName")}</span>
      </div>

      {/* 菜单按钮（从共享 schema 生成） */}
      <div className="flex items-center gap-0.5">
        {menuSchema.map((group, i) => (
          <MenuButton
            key={group.id}
            group={group}
            locale={locale}
            isOpen={openIndex === i}
            onOpen={() => setOpenIndex(i)}
            onHover={() => setOpenIndex(i)}
            onClose={closeMenus}
            anyOpen={openIndex !== null}
          />
        ))}
      </div>
    </div>
  );
}
