import { useEffect, useMemo } from "react";
import { useShortcutsStore } from "@/stores";
import type { ShortcutId, ShortcutConfig } from "@shared";
import { createShortcutActions, type ShortcutActionContext } from "@/actions/shortcut-actions";

interface ShortcutDispatcherOptions {
  context: ShortcutActionContext;
  enabled?: boolean;
}

const MODIFIER_KEYS = new Set([
  "ShiftLeft",
  "ShiftRight",
  "ControlLeft",
  "ControlRight",
  "AltLeft",
  "AltRight",
  "MetaLeft",
  "MetaRight"
]);

function shouldIgnoreEvent(target: EventTarget | null, event: KeyboardEvent) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if (target.closest?.('[data-slot="dialog-content"]')) return true;
  if (target.isContentEditable) {
    if (!event.ctrlKey && !event.metaKey && !event.altKey) return true;
  }
  return false;
}

export function useShortcutDispatcher({ context, enabled = true }: ShortcutDispatcherOptions) {
  const shortcuts = useShortcutsStore((state) => state.shortcuts);
  const actions = useMemo(() => createShortcutActions(context).actions, [context]);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (shouldIgnoreEvent(event.target, event)) return;
      if (MODIFIER_KEYS.has(event.code)) return;

      const entries = Object.entries(shortcuts) as [ShortcutId, ShortcutConfig[ShortcutId]][];
      const isMac = navigator.userAgent.toLowerCase().includes("mac");
      for (const [id, binding] of entries) {
        const normalized =
          isMac && id !== "toggleTerminal" && binding.ctrl ? { ...binding, ctrl: false, meta: true } : binding;
        if (
          event.code === normalized.code &&
          event.ctrlKey === normalized.ctrl &&
          event.shiftKey === normalized.shift &&
          event.altKey === normalized.alt &&
          event.metaKey === normalized.meta
        ) {
          event.preventDefault();
          actions[id]?.();
          return;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [actions, enabled, shortcuts]);
}
