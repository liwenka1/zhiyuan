export type ShortcutId =
  | "importRss"
  | "createFolder"
  | "toggleFolderSidebar"
  | "openSettings"
  | "createNoteFromUrl"
  | "createNote"
  | "toggleNoteSearch"
  | "togglePreviewMode"
  | "toggleSplitMode"
  | "toggleExportPreview"
  | "togglePresentationMode"
  | "formatNote"
  | "toggleTerminal";

export interface ShortcutBinding {
  code: string;
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  meta: boolean;
}

export type ShortcutConfig = Record<ShortcutId, ShortcutBinding>;

export type ShortcutPlatform = "default" | "mac";

export interface ShortcutConflict {
  key: string;
  ids: ShortcutId[];
}

const MODIFIER_ORDER: Array<keyof Omit<ShortcutBinding, "code">> = ["ctrl", "shift", "alt", "meta"];

export function normalizeShortcutBinding(
  binding: ShortcutBinding,
  id: ShortcutId,
  platform: ShortcutPlatform = "default"
): ShortcutBinding {
  if (platform !== "mac") return binding;
  if (id === "toggleTerminal") return binding;
  if (!binding.ctrl) return binding;
  return {
    ...binding,
    ctrl: false,
    meta: true
  };
}

export function getShortcutBindingKey(
  binding: ShortcutBinding,
  id: ShortcutId,
  platform: ShortcutPlatform = "default"
): string {
  const normalized = normalizeShortcutBinding(binding, id, platform);
  const modifiers = MODIFIER_ORDER.map((key) => (normalized[key] ? "1" : "0")).join("");
  return `${modifiers}:${normalized.code}`;
}

export function findShortcutConflict(
  shortcuts: ShortcutConfig,
  targetId: ShortcutId,
  binding: ShortcutBinding,
  platform: ShortcutPlatform = "default"
): ShortcutId | null {
  const targetKey = getShortcutBindingKey(binding, targetId, platform);
  for (const [id, currentBinding] of Object.entries(shortcuts) as [ShortcutId, ShortcutBinding][]) {
    if (id === targetId) continue;
    if (getShortcutBindingKey(currentBinding, id, platform) === targetKey) {
      return id;
    }
  }
  return null;
}

export function findShortcutConflicts(
  shortcuts: ShortcutConfig,
  platform: ShortcutPlatform = "default"
): ShortcutConflict[] {
  const keyToIds = new Map<string, ShortcutId[]>();

  for (const [id, binding] of Object.entries(shortcuts) as [ShortcutId, ShortcutBinding][]) {
    const key = getShortcutBindingKey(binding, id, platform);
    const ids = keyToIds.get(key);
    if (ids) {
      ids.push(id);
    } else {
      keyToIds.set(key, [id]);
    }
  }

  return Array.from(keyToIds.entries())
    .filter(([, ids]) => ids.length > 1)
    .map(([key, ids]) => ({ key, ids }));
}

export const DEFAULT_SHORTCUTS: ShortcutConfig = {
  importRss: {
    code: "KeyR",
    ctrl: true,
    shift: true,
    alt: false,
    meta: false
  },
  createFolder: {
    code: "KeyN",
    ctrl: true,
    shift: false,
    alt: true,
    meta: false
  },
  toggleFolderSidebar: {
    code: "KeyB",
    ctrl: true,
    shift: false,
    alt: false,
    meta: false
  },
  openSettings: {
    code: "Comma",
    ctrl: true,
    shift: false,
    alt: false,
    meta: false
  },
  createNoteFromUrl: {
    code: "KeyU",
    ctrl: true,
    shift: true,
    alt: false,
    meta: false
  },
  createNote: {
    code: "KeyN",
    ctrl: true,
    shift: true,
    alt: false,
    meta: false
  },
  toggleNoteSearch: {
    code: "KeyF",
    ctrl: true,
    shift: true,
    alt: false,
    meta: false
  },
  togglePreviewMode: {
    code: "Digit1",
    ctrl: true,
    shift: false,
    alt: false,
    meta: false
  },
  toggleSplitMode: {
    code: "Digit2",
    ctrl: true,
    shift: false,
    alt: false,
    meta: false
  },
  toggleExportPreview: {
    code: "Digit3",
    ctrl: true,
    shift: false,
    alt: false,
    meta: false
  },
  togglePresentationMode: {
    code: "Digit4",
    ctrl: true,
    shift: false,
    alt: false,
    meta: false
  },
  formatNote: {
    code: "KeyF",
    ctrl: false,
    shift: true,
    alt: true,
    meta: false
  },
  toggleTerminal: {
    code: "Backquote",
    ctrl: true,
    shift: false,
    alt: false,
    meta: false
  }
};
