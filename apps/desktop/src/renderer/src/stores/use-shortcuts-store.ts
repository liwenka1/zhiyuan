import { create } from "zustand";
import { configIpc } from "@/ipc";
import { DEFAULT_SHORTCUTS, type ShortcutBinding, type ShortcutConfig, type ShortcutId } from "@shared";

interface ShortcutsState {
  shortcuts: ShortcutConfig;
  isLoaded: boolean;
  load: () => Promise<void>;
  subscribeToChanges: () => () => void;
  setShortcut: (id: ShortcutId, binding: ShortcutBinding) => Promise<boolean>;
  resetShortcut: (id: ShortcutId) => Promise<boolean>;
}

export const useShortcutsStore = create<ShortcutsState>((set, get) => {
  let loading: Promise<void> | undefined;
  let latestSave = Promise.resolve(true);
  let changeVersion = 0;

  const setShortcut = (id: ShortcutId, binding: ShortcutBinding) => {
    const save = latestSave.then(async () => {
      try {
        const beforeSave = changeVersion;
        const shortcuts = await configIpc.setShortcut(id, binding);
        if (beforeSave === changeVersion) set({ shortcuts, isLoaded: true });
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
      const beforeLoad = changeVersion;
      loading ??= configIpc
        .getShortcuts()
        .then((shortcuts) => {
          if (beforeLoad === changeVersion && !get().isLoaded) {
            set({ shortcuts: { ...DEFAULT_SHORTCUTS, ...shortcuts }, isLoaded: true });
          }
        })
        .catch(() => set({ isLoaded: true }))
        .finally(() => {
          loading = undefined;
        });
      await loading;
    },

    subscribeToChanges: () =>
      configIpc.onShortcutsChanged((shortcuts) => {
        changeVersion += 1;
        set({ shortcuts, isLoaded: true });
      }),

    setShortcut,
    resetShortcut: (id) => setShortcut(id, DEFAULT_SHORTCUTS[id])
  };
});
