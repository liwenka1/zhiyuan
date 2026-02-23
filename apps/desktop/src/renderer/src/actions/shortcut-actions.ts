import { useViewStore } from "@/stores";
import type { ShortcutId } from "@shared";

export interface ShortcutActionContext {
  openSettings: () => void;
  openCreateFolderDialog: () => void;
  openRssImportDialog: () => void;
  openUrlCreateDialog: () => void;
  toggleNoteSearch: () => void;
  formatNote: () => void;
}

export function createShortcutActions(context: ShortcutActionContext) {
  const viewStore = useViewStore;

  const actions: Record<ShortcutId, () => void> = {
    importRss: () => context.openRssImportDialog(),
    createFolder: () => context.openCreateFolderDialog(),
    toggleFolderSidebar: () => viewStore.getState().toggleFolderSidebar(),
    openSettings: () => context.openSettings(),
    createNoteFromUrl: () => context.openUrlCreateDialog(),
    createNote: () => window.dispatchEvent(new Event("app:open-create-note")),
    toggleNoteSearch: () => context.toggleNoteSearch(),
    togglePreviewMode: () => {
      const state = viewStore.getState();
      const isPreview =
        state.editorMode === "preview" && !state.previewConfig.exportPreview && !state.isPresentationMode;
      state.setExclusiveMode(isPreview ? "edit" : "preview");
    },
    toggleSplitMode: () => {
      const state = viewStore.getState();
      const isSplit = state.editorMode === "split" && !state.isPresentationMode;
      state.setExclusiveMode(isSplit ? "edit" : "split");
    },
    toggleExportPreview: () => {
      const state = viewStore.getState();
      const isExportPreview = state.previewConfig.exportPreview && !state.isPresentationMode;
      state.setExclusiveMode(isExportPreview ? "edit" : "exportPreview");
    },
    togglePresentationMode: () => {
      const state = viewStore.getState();
      state.setExclusiveMode(state.isPresentationMode ? "edit" : "presentation");
    },
    formatNote: () => context.formatNote(),
    toggleTerminal: () => {
      const state = viewStore.getState();
      state.setTerminalOpen(!state.isTerminalOpen);
    }
  };

  return {
    actions
  };
}
