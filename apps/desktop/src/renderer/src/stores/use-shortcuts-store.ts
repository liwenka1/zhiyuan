import { create } from "zustand";
import { configIpc } from "@/ipc";
import { DEFAULT_SHORTCUTS, type ShortcutBinding, type ShortcutConfig, type ShortcutId } from "@shared";

interface ShortcutsState {
  shortcuts: ShortcutConfig;
  isLoaded: boolean;
  load: () => Promise<void>;
  setShortcut: (id: ShortcutId, binding: ShortcutBinding) => Promise<void>;
  resetShortcut: (id: ShortcutId) => Promise<void>;
}

export const useShortcutsStore = create<ShortcutsState>((set, get) => ({
  shortcuts: DEFAULT_SHORTCUTS,
  isLoaded: false,

  load: async () => {
    if (get().isLoaded) return;
    try {
      const shortcuts = await configIpc.getShortcuts();
      set({ shortcuts: { ...DEFAULT_SHORTCUTS, ...shortcuts }, isLoaded: true });
    } catch {
      set({ shortcuts: DEFAULT_SHORTCUTS, isLoaded: true });
    }
  },

  setShortcut: async (id, binding) => {
    const current = get().shortcuts;
    const next = { ...current, [id]: binding };
    set({ shortcuts: next });
    await configIpc.setShortcuts(next).catch(() => {
      set({ shortcuts: current });
    });
  },

  resetShortcut: async (id) => {
    const current = get().shortcuts;
    const next = { ...current, [id]: DEFAULT_SHORTCUTS[id] };
    set({ shortcuts: next });
    await configIpc.setShortcuts(next).catch(() => {
      set({ shortcuts: current });
    });
  }
}));
