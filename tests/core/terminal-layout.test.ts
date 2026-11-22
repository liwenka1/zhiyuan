import { afterEach, expect, it, vi } from "vitest";

const { effects, fit, terminalIpc } = vi.hoisted(() => ({
  effects: [] as Array<() => (() => void) | undefined>,
  fit: vi.fn(),
  terminalIpc: {
    create: vi.fn().mockResolvedValue(undefined),
    resize: vi.fn().mockResolvedValue(undefined),
    dispose: vi.fn().mockResolvedValue(undefined),
    onData: vi.fn(() => vi.fn()),
    onExit: vi.fn<(callback: (event: { id: string; exitCode: number }) => void) => () => void>(() => vi.fn())
  }
}));

vi.mock("react", () => ({
  useEffect: (effect: (typeof effects)[number]) => effects.push(effect),
  useRef: (initialValue: unknown) => ({ current: initialValue })
}));
vi.mock("@xterm/xterm", () => ({
  Terminal: class {
    cols = 80;
    rows = 24;
    loadAddon() {}
    open() {}
    write() {}
    writeln() {}
    onData() {
      return { dispose: vi.fn() };
    }
    dispose() {}
  }
}));
vi.mock("@xterm/addon-fit", () => ({
  FitAddon: class {
    fit = fit;
  }
}));
vi.mock("@xterm/addon-webgl", () => ({ WebglAddon: class {} }));
vi.mock("@/ipc", () => ({ terminalIpc }));

import { useTerminal } from "../../apps/desktop/src/renderer/src/features/terminal/hooks/use-terminal";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("fits the transcript on pane resize even if the shell exited before the first fit", async () => {
  vi.useFakeTimers();
  let notifyResize: () => void = () => {};
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        notifyResize = callback;
      }
      observe() {}
      disconnect() {}
    }
  );
  vi.stubGlobal(
    "MutationObserver",
    class {
      observe() {}
      disconnect() {}
    }
  );
  vi.stubGlobal("document", { documentElement: {} });
  vi.stubGlobal("window", { localStorage: { getItem: () => "off" } });
  vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: () => "" }));
  vi.stubGlobal("requestAnimationFrame", vi.fn());

  useTerminal({ isActive: true, containerRef: { current: { clientWidth: 600, clientHeight: 300 } as HTMLDivElement } });
  const cleanup = effects[0]();
  try {
    const [sessionId] = terminalIpc.create.mock.calls[0];
    const [onExit] = terminalIpc.onExit.mock.calls[0];
    onExit({ id: sessionId, exitCode: 0 });
    expect(fit).not.toHaveBeenCalled();

    notifyResize();
    await vi.advanceTimersByTimeAsync(16);
    expect(fit).toHaveBeenCalledOnce();
    expect(terminalIpc.resize).not.toHaveBeenCalled();
  } finally {
    cleanup?.();
  }
});
