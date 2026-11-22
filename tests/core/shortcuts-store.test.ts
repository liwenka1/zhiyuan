import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SHORTCUTS } from "../../apps/desktop/src/shared/shortcuts";

const { getShortcuts, setShortcut, onShortcutsChanged } = vi.hoisted(() => ({
  getShortcuts: vi.fn(),
  setShortcut: vi.fn(),
  onShortcutsChanged: vi.fn()
}));

vi.mock("@/ipc", () => ({ configIpc: { getShortcuts, setShortcut, onShortcutsChanged } }));

import { useShortcutsStore } from "../../apps/desktop/src/renderer/src/stores/use-shortcuts-store";

const searchShortcut = { ...DEFAULT_SHORTCUTS.toggleNoteSearch, code: "KeyK" };
const settingsShortcut = { ...DEFAULT_SHORTCUTS.openSettings, code: "Period" };

describe("shortcut persistence", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useShortcutsStore.setState({ shortcuts: DEFAULT_SHORTCUTS, isLoaded: true });
  });

  it("reports failed saves and allows the same binding to be retried", async () => {
    setShortcut.mockRejectedValueOnce(new Error("disk full")).mockResolvedValueOnce({
      ...DEFAULT_SHORTCUTS,
      toggleNoteSearch: searchShortcut
    });

    expect(await useShortcutsStore.getState().setShortcut("toggleNoteSearch", searchShortcut)).toBe(false);
    expect(useShortcutsStore.getState().shortcuts.toggleNoteSearch).toBe(DEFAULT_SHORTCUTS.toggleNoteSearch);

    expect(await useShortcutsStore.getState().setShortcut("toggleNoteSearch", searchShortcut)).toBe(true);
    expect(useShortcutsStore.getState().shortcuts.toggleNoteSearch).toEqual(searchShortcut);
  });

  it("saves individual bindings in order and recovers after a failed write", async () => {
    let failFirstSave!: (error: Error) => void;
    const firstSave = new Promise<void>((_, reject) => {
      failFirstSave = reject;
    });
    setShortcut.mockReturnValueOnce(firstSave).mockResolvedValueOnce({
      ...DEFAULT_SHORTCUTS,
      openSettings: settingsShortcut
    });

    const { setShortcut: saveShortcut } = useShortcutsStore.getState();
    const saveSearch = saveShortcut("toggleNoteSearch", searchShortcut);
    const saveSettings = saveShortcut("openSettings", settingsShortcut);

    await vi.waitFor(() => expect(setShortcut).toHaveBeenCalledOnce());
    failFirstSave(new Error("shortcut conflict"));
    expect(await Promise.all([saveSearch, saveSettings])).toEqual([false, true]);
    expect(setShortcut).toHaveBeenLastCalledWith("openSettings", settingsShortcut);
    expect(useShortcutsStore.getState().shortcuts.openSettings).toEqual(settingsShortcut);
  });

  it("preserves bindings sourced from another window when a startup read is stale", async () => {
    useShortcutsStore.setState({ isLoaded: false });
    let resolveRead!: (config: typeof DEFAULT_SHORTCUTS) => void;
    getShortcuts.mockReturnValue(new Promise((resolve) => (resolveRead = resolve)));
    const unsubscribe = vi.fn();
    onShortcutsChanged.mockReturnValue(unsubscribe);

    const { load, subscribeToChanges } = useShortcutsStore.getState();
    const cleanup = subscribeToChanges();
    const read = load();
    const newConfig = { ...DEFAULT_SHORTCUTS, openSettings: settingsShortcut };
    onShortcutsChanged.mock.calls[0][0](newConfig);
    resolveRead(DEFAULT_SHORTCUTS);
    await read;

    expect(useShortcutsStore.getState().shortcuts).toEqual(newConfig);
    cleanup();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
