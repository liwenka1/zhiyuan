import { useEffect, useRef, type RefObject } from "react";
import { Terminal, type ITheme } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import { terminalIpc } from "@/ipc";
import { useWorkspaceStore } from "@/stores";

interface UseTerminalOptions {
  containerRef: RefObject<HTMLDivElement | null>;
  isActive: boolean;
}

function createTerminalTheme(): ITheme {
  const styles = getComputedStyle(document.documentElement);
  const getVar = (name: string, fallback: string) => {
    const value = styles.getPropertyValue(name).trim();
    return value || fallback;
  };
  return {
    background: getVar("--background", "#ffffff"),
    foreground: getVar("--foreground", "#000000"),
    cursor: getVar("--foreground", "#000000"),
    cursorAccent: getVar("--background", "#ffffff"),
    selectionBackground: getVar("--accent", "#cccccc")
  };
}

export function useTerminal({ containerRef, isActive }: UseTerminalOptions) {
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isActiveRef = useRef(isActive);
  const applyResizeRef = useRef<(() => void) | null>(null);
  const hasStableLayoutRef = useRef(false);
  const pendingOutputRef = useRef<string[]>([]);

  useEffect(() => {
    if (!containerRef.current) return;

    let mounted = true;
    let terminalId: string | null = null;
    const fitAddon = new FitAddon();
    const terminal = new Terminal({
      cursorBlink: true,
      convertEol: true,
      scrollback: 1000,
      fontFamily: '"Menlo", "Monaco", "SF Mono", "Consolas", "Noto Sans Mono CJK SC", "Source Han Mono SC", monospace',
      fontSize: 12,
      fontWeight: "normal",
      fontWeightBold: "bold",
      lineHeight: 1,
      letterSpacing: 0,
      customGlyphs: true,
      theme: createTerminalTheme(),
      // Avoid compositor artifacts in some Electron hosts (e.g. right-edge gaps).
      allowTransparency: false,
      tabStopWidth: 8
    });

    terminal.loadAddon(fitAddon);
    terminal.open(containerRef.current);

    // Allow quick fallback for machines where GPU renderer causes visual artifacts.
    const enableWebgl = window.localStorage.getItem("terminal.webgl") !== "off";
    if (enableWebgl) {
      try {
        const webglAddon = new WebglAddon();
        terminal.loadAddon(webglAddon);
        webglAddon.onContextLoss(() => {
          webglAddon.dispose();
        });
      } catch {
        // Keep default renderer when WebGL is not supported in host environment.
      }
    }

    const flushPendingOutput = () => {
      if (pendingOutputRef.current.length === 0) return;
      terminal.write(pendingOutputRef.current.join(""));
      pendingOutputRef.current = [];
    };

    const applyResize = () => {
      if (!isActiveRef.current || !terminalId || !containerRef.current) return;
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      // Guard against transient zero/small sizes during tab visibility switch.
      if (width < 20 || height < 20) return;
      // 统一使用 xterm 官方 fit 算法，避免手算列数导致中文输入偏移和提前换行
      fitAddon.fit();
      if (terminal.cols < 2 || terminal.rows < 1) return;
      hasStableLayoutRef.current = true;
      flushPendingOutput();
      void terminalIpc.resize(terminalId, terminal.cols, terminal.rows).catch(() => {});
    };
    applyResizeRef.current = applyResize;

    const stopDataSubscription = terminalIpc.onData(({ id, data }) => {
      if (id !== terminalId) return;
      if (!hasStableLayoutRef.current) {
        pendingOutputRef.current.push(data);
        return;
      }
      terminal.write(data);
    });

    const stopExitSubscription = terminalIpc.onExit(({ id, exitCode }) => {
      if (id !== terminalId) return;
      terminal.writeln("");
      terminal.writeln(`[shell exited: ${exitCode}]`);
    });

    const resizeObserver = new ResizeObserver(() => {
      if (!isActiveRef.current) return;
      // 防抖处理resize事件
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
      resizeTimeoutRef.current = setTimeout(() => {
        applyResize();
      }, 16); // ~60fps
    });
    resizeObserver.observe(containerRef.current);

    const stopTerminalInput = terminal.onData((data) => {
      if (!terminalId) return;
      void terminalIpc.write(terminalId, data).catch(() => {});
    });

    const themeObserver = new MutationObserver(() => {
      terminal.options.theme = createTerminalTheme();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style"]
    });

    const init = async () => {
      try {
        const { workspacePath } = useWorkspaceStore.getState();
        const { id } = await terminalIpc.create(workspacePath ?? undefined);
        if (!mounted) {
          void terminalIpc.dispose(id).catch(() => {});
          return;
        }
        terminalId = id;
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            applyResize();
          });
        });
      } catch {
        terminal.writeln("[failed to start shell]");
      }
    };
    void init();

    return () => {
      mounted = false;
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
      applyResizeRef.current = null;
      hasStableLayoutRef.current = false;
      pendingOutputRef.current = [];
      stopDataSubscription();
      stopExitSubscription();
      stopTerminalInput.dispose();
      resizeObserver.disconnect();
      themeObserver.disconnect();
      if (terminalId) {
        void terminalIpc.dispose(terminalId).catch(() => {});
      }
      terminal.dispose();
    };
  }, [containerRef]);

  useEffect(() => {
    isActiveRef.current = isActive;
    if (!isActive) return;
    const applyResize = applyResizeRef.current;
    if (!applyResize) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        applyResize();
      });
    });
  }, [isActive]);

  return undefined;
}
