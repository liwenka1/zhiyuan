import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { themeSetMock, themeGetMock, themeModeMock, themeChangedMock } = vi.hoisted(() => ({
  themeSetMock: vi.fn(),
  themeGetMock: vi.fn(),
  themeModeMock: vi.fn(),
  themeChangedMock: vi.fn(() => vi.fn())
}));

vi.mock("@/ipc", () => ({
  themeIpc: {
    set: themeSetMock,
    get: themeGetMock,
    getMode: themeModeMock,
    onChanged: themeChangedMock
  }
}));

let useThemeStore: typeof import("../../apps/desktop/src/renderer/src/stores/use-theme-store").useThemeStore;

beforeAll(async () => {
  vi.stubGlobal("document", {
    documentElement: {
      classList: {
        add: vi.fn(),
        remove: vi.fn()
      }
    }
  });
  vi.stubGlobal("window", {
    matchMedia: () => ({ matches: false })
  });
  ({ useThemeStore } = await import("../../apps/desktop/src/renderer/src/stores/use-theme-store"));
});

describe("theme persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useThemeStore.setState({ theme: "light", themeMode: "system" });
  });

  afterEach(() => useThemeStore.getState().cleanup());

  it("rolls back the optimistic theme when persistence fails", async () => {
    themeSetMock.mockRejectedValueOnce(new Error("disk full"));

    await useThemeStore.getState().setTheme("dark");

    expect(useThemeStore.getState()).toMatchObject({ theme: "light", themeMode: "system" });
  });

  it("keeps the optimistic theme after persistence succeeds", async () => {
    themeSetMock.mockResolvedValueOnce(undefined);

    await useThemeStore.getState().setTheme("dark");

    expect(useThemeStore.getState()).toMatchObject({ theme: "dark", themeMode: "dark" });
  });

  it("synchronizes the preference and appearance even before the initial read returns", async () => {
    let finishRead!: (theme: "light") => void;
    themeGetMock.mockReturnValueOnce(new Promise((resolve) => (finishRead = resolve)));
    themeModeMock.mockResolvedValueOnce("system");

    const read = useThemeStore.getState().initTheme();
    const [notify] = themeChangedMock.mock.calls[0] as unknown as [(theme: "dark", mode: "dark") => void];
    notify("dark", "dark");
    finishRead("light");
    await read;

    expect(useThemeStore.getState()).toMatchObject({ theme: "dark", themeMode: "dark" });
  });
});
