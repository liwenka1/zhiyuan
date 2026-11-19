import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SHORTCUTS } from "../../apps/desktop/src/shared/shortcuts";

const { getShortcuts, setShortcuts } = vi.hoisted(() => ({
  getShortcuts: vi.fn(),
  setShortcuts: vi.fn()
}));

vi.mock("@/ipc", () => ({ configIpc: { getShortcuts, setShortcuts } }));

import { useShortcutsStore } from "../../apps/desktop/src/renderer/src/stores/use-shortcuts-store";

const searchShortcut = { ...DEFAULT_SHORTCUTS.toggleNoteSearch, code: "KeyK" };
const settingsShortcut = { ...DEFAULT_SHORTCUTS.openSettings, code: "Period" };

describe("shortcut persistence", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useShortcutsStore.setState({ shortcuts: DEFAULT_SHORTCUTS, isLoaded: true });
  });

  it("reports failed saves and allows the same binding to be retried", async () => {
    setShortcuts.mockRejectedValueOnce(new Error("disk full")).mockResolvedValueOnce(undefined);

    expect(await useShortcutsStore.getState().setShortcut("toggleNoteSearch", searchShortcut)).toBe(false);
    expect(useShortcutsStore.getState().shortcuts.toggleNoteSearch).toBe(DEFAULT_SHORTCUTS.toggleNoteSearch);

    expect(await useShortcutsStore.getState().setShortcut("toggleNoteSearch", searchShortcut)).toBe(true);
    expect(useShortcutsStore.getState().shortcuts.toggleNoteSearch).toEqual(searchShortcut);
  });

  it("saves full configs in order without carrying forward an earlier failed write", async () => {
    let failFirstSave!: (error: Error) => void;
    const firstSave = new Promise<void>((_, reject) => {
      failFirstSave = reject;
    });
    setShortcuts.mockReturnValueOnce(firstSave).mockResolvedValueOnce(undefined);

    const { setShortcut } = useShortcutsStore.getState();
    const saveSearch = setShortcut("toggleNoteSearch", searchShortcut);
    const saveSettings = setShortcut("openSettings", settingsShortcut);

    await vi.waitFor(() => expect(setShortcuts).toHaveBeenCalledOnce());
    failFirstSave(new Error("shortcut conflict"));
    expect(await Promise.all([saveSearch, saveSettings])).toEqual([false, true]);
    expect(setShortcuts).toHaveBeenLastCalledWith({ ...DEFAULT_SHORTCUTS, openSettings: settingsShortcut });
    expect(useShortcutsStore.getState().shortcuts.openSettings).toEqual(settingsShortcut);
  });

  it("loads existing bindings before overwriting stored config", async () => {
    useShortcutsStore.setState({ isLoaded: false });
    getShortcuts.mockResolvedValue({ ...DEFAULT_SHORTCUTS, openSettings: settingsShortcut });
    setShortcuts.mockResolvedValue(undefined);

    const { load, setShortcut } = useShortcutsStore.getState();
    await Promise.all([setShortcut("toggleNoteSearch", searchShortcut), load()]);

    expect(getShortcuts).toHaveBeenCalledOnce();
    expect(setShortcuts).toHaveBeenCalledWith({
      ...DEFAULT_SHORTCUTS,
      openSettings: settingsShortcut,
      toggleNoteSearch: searchShortcut
    });
  });
});
