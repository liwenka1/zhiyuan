import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { themeSetMock } = vi.hoisted(() => ({
  themeSetMock: vi.fn()
}));

vi.mock("@/ipc", () => ({
  themeIpc: {
    set: themeSetMock,
    get: vi.fn(),
    getMode: vi.fn(),
    onChanged: vi.fn(() => vi.fn())
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
    themeSetMock.mockReset();
    useThemeStore.setState({ theme: "light", themeMode: "system" });
  });

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
});
