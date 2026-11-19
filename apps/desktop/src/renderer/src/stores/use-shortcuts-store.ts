import { create } from "zustand";
import { configIpc } from "@/ipc";
import { DEFAULT_SHORTCUTS, type ShortcutBinding, type ShortcutConfig, type ShortcutId } from "@shared";

interface ShortcutsState {
  shortcuts: ShortcutConfig;
  isLoaded: boolean;
  load: () => Promise<void>;
  setShortcut: (id: ShortcutId, binding: ShortcutBinding) => Promise<boolean>;
  resetShortcut: (id: ShortcutId) => Promise<boolean>;
}

export const useShortcutsStore = create<ShortcutsState>((set, get) => {
  let loading: Promise<void> | undefined;
  let latestSave = Promise.resolve(true);

  const setShortcut = (id: ShortcutId, binding: ShortcutBinding) => {
    // The main process replaces the full config. Build each write from the last saved state.
    const save = latestSave.then(async () => {
      await get().load();
      const next = { ...get().shortcuts, [id]: binding };
      try {
        await configIpc.setShortcuts(next);
        set({ shortcuts: next });
        return true;
      } catch {
        return false;
      }
    });
    latestSave = save;
    return save;
  };

  return {
    shortcuts: DEFAULT_SHORTCUTS,
    isLoaded: false,

    load: async () => {
      if (get().isLoaded) return;
      loading ??= configIpc
        .getShortcuts()
        .then((shortcuts) => set({ shortcuts: { ...DEFAULT_SHORTCUTS, ...shortcuts }, isLoaded: true }))
        .catch(() => set({ shortcuts: DEFAULT_SHORTCUTS, isLoaded: true }))
        .finally(() => {
          loading = undefined;
        });
      await loading;
    },

    setShortcut,
    resetShortcut: (id) => setShortcut(id, DEFAULT_SHORTCUTS[id])
  };
});
