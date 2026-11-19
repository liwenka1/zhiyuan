import { useEffect, useMemo } from "react";
import { useShortcutsStore } from "@/stores";
import { normalizeShortcutBinding, type ShortcutId, type ShortcutConfig } from "@shared";
import { createShortcutActions, type ShortcutActionContext } from "@/actions/shortcut-actions";

interface ShortcutDispatcherOptions {
  context: ShortcutActionContext;
  enabled?: boolean;
  allowedShortcuts?: ReadonlySet<ShortcutId>;
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

const editorShortcutHandlers = new WeakMap<Window, (event: KeyboardEvent) => boolean>();

export function dispatchEditorShortcut(event: KeyboardEvent): boolean {
  return editorShortcutHandlers.get(window)?.(event) ?? false;
}

function shouldIgnoreEvent(target: EventTarget | null, event: KeyboardEvent) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.closest?.(".xterm")) return false;
  const tag = target.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if (target.closest?.('[role="dialog"], [role="alertdialog"]')) return true;
  if (target.isContentEditable) {
    if (!event.ctrlKey && !event.metaKey && !event.altKey) return true;
  }
  return false;
}

export function useShortcutDispatcher({ context, enabled = true, allowedShortcuts }: ShortcutDispatcherOptions) {
  const shortcuts = useShortcutsStore((state) => state.shortcuts);
  const actions = useMemo(() => createShortcutActions(context).actions, [context]);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent): boolean => {
      if (event.defaultPrevented || event.isComposing || shouldIgnoreEvent(event.target, event)) {
        return false;
      }
      if (MODIFIER_KEYS.has(event.code)) return false;

      const entries = Object.entries(shortcuts) as [ShortcutId, ShortcutConfig[ShortcutId]][];
      const isMac = navigator.userAgent.toLowerCase().includes("mac");
      for (const [id, binding] of entries) {
        if (allowedShortcuts && !allowedShortcuts.has(id)) continue;
        const normalized = isMac ? normalizeShortcutBinding(binding, id, "mac") : binding;
        if (
          event.code === normalized.code &&
          event.ctrlKey === normalized.ctrl &&
          event.shiftKey === normalized.shift &&
          event.altKey === normalized.alt &&
          event.metaKey === normalized.meta
        ) {
          event.preventDefault();
          if (!event.repeat) actions[id]?.();
          return true;
        }
      }
      return false;
    };

    editorShortcutHandlers.set(window, handleKeyDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      editorShortcutHandlers.delete(window);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [actions, allowedShortcuts, enabled, shortcuts]);
}
