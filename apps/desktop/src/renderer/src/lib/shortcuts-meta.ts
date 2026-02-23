import type { ShortcutId, ShortcutBinding } from "@shared";

export type ShortcutGroupId = "folder" | "noteList" | "editor";

export interface ShortcutMeta {
  id: ShortcutId;
  group: ShortcutGroupId;
  labelKey: string;
  descriptionKey?: string;
  default: ShortcutBinding;
}

export const shortcutGroups: { id: ShortcutGroupId; labelKey: string }[] = [
  { id: "folder", labelKey: "settings.shortcutsGroupFolder" },
  { id: "noteList", labelKey: "settings.shortcutsGroupNoteList" },
  { id: "editor", labelKey: "settings.shortcutsGroupEditor" }
];

export const shortcutsMeta: ShortcutMeta[] = [
  {
    id: "importRss",
    group: "folder",
    labelKey: "settings.shortcutsImportRss",
    default: { code: "KeyR", ctrl: true, shift: true, alt: false, meta: false }
  },
  {
    id: "createFolder",
    group: "folder",
    labelKey: "settings.shortcutsCreateFolder",
    default: { code: "KeyN", ctrl: true, shift: false, alt: true, meta: false }
  },
  {
    id: "toggleFolderSidebar",
    group: "folder",
    labelKey: "settings.shortcutsToggleFolderSidebar",
    default: { code: "KeyB", ctrl: true, shift: false, alt: false, meta: false }
  },
  {
    id: "openSettings",
    group: "folder",
    labelKey: "settings.shortcutsOpenSettings",
    default: { code: "Comma", ctrl: true, shift: false, alt: false, meta: false }
  },
  {
    id: "createNoteFromUrl",
    group: "noteList",
    labelKey: "settings.shortcutsCreateFromUrl",
    default: { code: "KeyU", ctrl: true, shift: true, alt: false, meta: false }
  },
  {
    id: "createNote",
    group: "noteList",
    labelKey: "settings.shortcutsCreateNote",
    default: { code: "KeyN", ctrl: true, shift: true, alt: false, meta: false }
  },
  {
    id: "toggleNoteSearch",
    group: "noteList",
    labelKey: "settings.shortcutsToggleNoteSearch",
    default: { code: "KeyF", ctrl: true, shift: true, alt: false, meta: false }
  },
  {
    id: "togglePreviewMode",
    group: "editor",
    labelKey: "settings.shortcutsTogglePreview",
    default: { code: "Digit1", ctrl: true, shift: false, alt: false, meta: false }
  },
  {
    id: "toggleSplitMode",
    group: "editor",
    labelKey: "settings.shortcutsToggleSplit",
    default: { code: "Digit2", ctrl: true, shift: false, alt: false, meta: false }
  },
  {
    id: "toggleExportPreview",
    group: "editor",
    labelKey: "settings.shortcutsToggleExportPreview",
    default: { code: "Digit3", ctrl: true, shift: false, alt: false, meta: false }
  },
  {
    id: "togglePresentationMode",
    group: "editor",
    labelKey: "settings.shortcutsTogglePresentation",
    default: { code: "Digit4", ctrl: true, shift: false, alt: false, meta: false }
  },
  {
    id: "formatNote",
    group: "editor",
    labelKey: "settings.shortcutsFormatNote",
    default: { code: "KeyF", ctrl: false, shift: true, alt: true, meta: false }
  },
  {
    id: "toggleTerminal",
    group: "editor",
    labelKey: "settings.shortcutsToggleTerminal",
    default: { code: "Backquote", ctrl: true, shift: false, alt: false, meta: false }
  }
];

export const shortcutsMetaById = new Map(shortcutsMeta.map((item) => [item.id, item]));
