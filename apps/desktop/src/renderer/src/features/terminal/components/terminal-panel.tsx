import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ListRow } from "@/components/app/list-row";
import { IconButton } from "@/components/ui/button";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup, useGroupRef } from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useViewStore } from "@/stores";
import { cn } from "@/lib/utils";
import { useTerminal } from "../hooks/use-terminal";
import "@xterm/xterm/css/xterm.css";

export function TerminalPanel() {
  const setTerminalOpen = useViewStore((state) => state.setTerminalOpen);
  const splitGroupRef = useGroupRef();
  const nextIndexRef = useRef(2);
  const [sessions, setSessions] = useState(() => [createTerminalSession(1)]);
  const [activeSessionId, setActiveSessionId] = useState(() => sessions[0]?.id ?? "");

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) ?? sessions[0],
    [activeSessionId, sessions]
  );
  const activeSessionIdSafe = activeSession?.id ?? "";

  const handleAddTerminal = useCallback(() => {
    const index = nextIndexRef.current;
    nextIndexRef.current += 1;
    const nextSession = createTerminalSession(index);
    setSessions((prev) => [...prev, nextSession]);
    setActiveSessionId(nextSession.id);
  }, []);

  const handleActivateSession = useCallback((id: string) => {
    setActiveSessionId(id);
  }, []);

  useEffect(() => {
    if (!splitGroupRef.current) return;
    if (sessions.length >= 2) {
      splitGroupRef.current.setLayout({ "terminal-main": 78, "terminal-list": 22 });
    } else {
      splitGroupRef.current.setLayout({ "terminal-main": 100, "terminal-list": 0 });
    }
  }, [sessions.length, splitGroupRef]);

  return (
    <section className="terminal-panel bg-background flex h-full min-h-0 flex-col">
      <div className="text-muted-foreground bg-background flex items-center justify-between px-3 py-1 text-xs">
        <div className="flex flex-1 items-center justify-end gap-1">
          <IconButton aria-label="New terminal" size="icon-compact" onClick={handleAddTerminal}>
            <Plus className="size-3.5" />
          </IconButton>
          <IconButton aria-label="Hide terminal" size="icon-compact" onClick={() => setTerminalOpen(false)}>
            <X className="size-3.5" />
          </IconButton>
        </div>
      </div>
      <div className="terminal-panel__body flex min-h-0 flex-1 overflow-hidden">
        <ResizablePanelGroup orientation="horizontal" className="h-full" groupRef={splitGroupRef}>
          <ResizablePanel id="terminal-main" defaultSize={sessions.length >= 2 ? "78%" : "100%"} minSize="55%">
            <div className="terminal-panel__viewport relative h-full min-h-0 overflow-hidden">
              {sessions.map((session) => (
                <TerminalSessionView
                  key={session.id}
                  sessionId={session.id}
                  isActive={session.id === activeSessionIdSafe}
                />
              ))}
            </div>
          </ResizablePanel>

          <ResizableHandle
            className={
              sessions.length >= 2
                ? "bg-border hover:bg-primary w-px transition-colors"
                : "pointer-events-none w-0 border-0 bg-transparent p-0 opacity-0"
            }
          />

          <ResizablePanel
            id="terminal-list"
            defaultSize={sessions.length >= 2 ? "22%" : "0%"}
            minSize="0%"
            maxSize="40%"
            collapsible
            collapsedSize="0%"
          >
            <ScrollArea className="terminal-panel__list h-full">
              <div className="terminal-panel__list-inner">
                {sessions.map((session) => (
                  <ListRow
                    key={session.id}
                    selected={session.id === activeSessionIdSafe}
                    muted={session.id !== activeSessionIdSafe}
                    className={cn("terminal-panel__list-item", session.id === activeSessionIdSafe && "is-active")}
                    onClick={() => handleActivateSession(session.id)}
                    label={session.label}
                    labelClassName="text-xs font-medium"
                  />
                ))}
              </div>
            </ScrollArea>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </section>
  );
}

interface TerminalSessionViewProps {
  sessionId: string;
  isActive: boolean;
}

function TerminalSessionView({ sessionId, isActive }: TerminalSessionViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();
  const { hasOutput } = useTerminal({ containerRef });

  return (
    <div
      data-terminal-id={sessionId}
      className={isActive ? "terminal-panel__session is-active" : "terminal-panel__session"}
    >
      <div ref={containerRef} className="h-full w-full overflow-hidden pl-2" />
      {isActive && !hasOutput && <div className="terminal-panel__empty">{t("terminal.ready")}</div>}
    </div>
  );
}

interface TerminalSession {
  id: string;
  label: string;
  index: number;
}

function createTerminalSession(index: number): TerminalSession {
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `terminal-${index}`;
  return { id, label: `Terminal ${index}`, index };
}
