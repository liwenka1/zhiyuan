export type ShortcutId = "toggleTerminal";

export interface ShortcutBinding {
  code: string;
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  meta: boolean;
}

export type ShortcutConfig = Record<ShortcutId, ShortcutBinding>;

export const DEFAULT_SHORTCUTS: ShortcutConfig = {
  toggleTerminal: {
    code: "Backquote",
    ctrl: true,
    shift: false,
    alt: false,
    meta: false
  }
};
