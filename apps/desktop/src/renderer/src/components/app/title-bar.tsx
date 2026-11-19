import { type CSSProperties, type ReactNode } from "react";
import { DEFAULT_TITLE_BAR_HEIGHT, WINDOWS_TITLE_BAR_HEIGHT } from "@shared/title-bar";
import { usePlatform } from "@/hooks";
import { AppMenuBar } from "./app-menu-bar";

interface ElectronCSSProperties extends CSSProperties {
  WebkitAppRegion?: "drag" | "no-drag";
}

interface TitleBarProps {
  children?: ReactNode;
  disabled?: boolean;
}

const interactiveStyle: ElectronCSSProperties = { WebkitAppRegion: "no-drag" };

export function TitleBar({ children, disabled }: TitleBarProps) {
  const { isMac, isWindows } = usePlatform();
  if (!isMac && !isWindows && !children) return null;

  const style: ElectronCSSProperties = {
    minHeight: (isWindows ? WINDOWS_TITLE_BAR_HEIGHT : DEFAULT_TITLE_BAR_HEIGHT) + 1,
    WebkitAppRegion: isMac || isWindows ? "drag" : undefined
  };

  return (
    <header
      data-titlebar
      inert={disabled}
      className="border-divider bg-background relative z-20 grid shrink-0 grid-cols-[minmax(0,1fr)_minmax(0,24rem)_minmax(0,1fr)] items-center border-b"
      style={style}
    >
      {isWindows && (
        <div className="col-start-1 row-start-1 flex min-w-0 items-center px-2">
          <AppMenuBar />
        </div>
      )}
      {children && (
        <div className="col-start-2 row-start-1 my-2 min-w-0" style={interactiveStyle}>
          {children}
        </div>
      )}
    </header>
  );
}
