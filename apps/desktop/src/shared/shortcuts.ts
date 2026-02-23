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
