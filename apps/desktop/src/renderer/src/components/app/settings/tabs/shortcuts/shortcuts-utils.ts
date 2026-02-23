import type { ShortcutBinding, ShortcutId } from "@shared";

type ModKey = "ctrl" | "shift" | "alt" | "meta";

const CODE_LABELS: Record<string, string> = {
  Backquote: "`",
  Escape: "Esc",
  Space: "Space",
  Enter: "Enter",
  Tab: "Tab",
  Backspace: "Backspace"
};

const MOD_LABELS: Record<ModKey, string> = {
  ctrl: "Ctrl",
  shift: "Shift",
  alt: "Alt",
  meta: "Meta"
};

const MAC_MOD_LABELS: Record<ModKey, string> = {
  ctrl: "^",
  shift: "Shift",
  alt: "Option",
  meta: "Cmd"
};

const MOD_ORDER: ModKey[] = ["ctrl", "shift", "alt", "meta"];

function labelForCode(code: string) {
  if (CODE_LABELS[code]) return CODE_LABELS[code];
  if (code.startsWith("Key")) return code.slice(3).toUpperCase();
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Arrow")) return code.slice(5);
  return code;
}

function normalizeMacBinding(binding: ShortcutBinding, id?: ShortcutId) {
  if (!id) return binding;
  if (id === "toggleTerminal") return binding;
  if (!binding.ctrl) return binding;
  return {
    ...binding,
    ctrl: false,
    meta: true
  };
}

export function buildBindingParts(binding: ShortcutBinding, isMac: boolean, id?: ShortcutId) {
  const items: string[] = [];
  const normalized = isMac ? normalizeMacBinding(binding, id) : binding;
  MOD_ORDER.forEach((key) => {
    if (!normalized[key]) return;
    if (isMac) {
      items.push(MAC_MOD_LABELS[key]);
      return;
    }
    items.push(MOD_LABELS[key]);
  });
  items.push(labelForCode(normalized.code));
  return items;
}
