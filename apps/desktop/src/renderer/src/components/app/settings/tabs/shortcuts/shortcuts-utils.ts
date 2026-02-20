import type { ShortcutBinding } from "@shared";

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

export function buildBindingParts(binding: ShortcutBinding, isMac: boolean) {
  const items: string[] = [];
  MOD_ORDER.forEach((key) => {
    if (!binding[key]) return;
    if (isMac) {
      items.push(MAC_MOD_LABELS[key]);
      return;
    }
    items.push(MOD_LABELS[key]);
  });
  items.push(labelForCode(binding.code));
  return items;
}
