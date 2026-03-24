import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pencil, Plus, X } from "lucide-react";
import { ListRow } from "@/components/app/list-row";
import { InputDialog } from "@/components/input-dialog";
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
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null);
  const hasSessionList = sessions.length >= 2;

  const activeSessionIdSafe = useMemo(() => {
    if (sessions.length === 0) return "";
    return sessions.some((session) => session.id === activeSessionId) ? activeSessionId : (sessions[0]?.id ?? "");
  }, [activeSessionId, sessions]);
  const renamingSession = useMemo(
    () => sessions.find((session) => session.id === renamingSessionId) ?? null,
    [renamingSessionId, sessions]
  );

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

  const handleRemoveSession = useCallback((id: string) => {
    setSessions((prev) => {
      if (prev.length <= 1) return prev;
      const removeIndex = prev.findIndex((session) => session.id === id);
      if (removeIndex < 0) return prev;

      const nextSessions = prev.filter((session) => session.id !== id);
      setActiveSessionId((currentActiveId) => {
        if (currentActiveId !== id) return currentActiveId;
        const fallbackSession = nextSessions[removeIndex] ?? nextSessions[removeIndex - 1] ?? nextSessions[0];
        return fallbackSession?.id ?? "";
      });
      return nextSessions;
    });
  }, []);

  const handleRenameSession = useCallback((id: string, label: string) => {
    const nextLabel = label.trim();
    if (!nextLabel) return;
    setSessions((prev) => prev.map((session) => (session.id === id ? { ...session, label: nextLabel } : session)));
  }, []);

  useEffect(() => {
    if (!splitGroupRef.current) return;
    if (hasSessionList) {
      splitGroupRef.current.setLayout({ "terminal-main": 78, "terminal-list": 22 });
    } else {
      splitGroupRef.current.setLayout({ "terminal-main": 100, "terminal-list": 0 });
    }
  }, [hasSessionList, splitGroupRef]);

  return (
    <section className="terminal-panel bg-background flex h-full min-h-0 flex-col">
      <div className="bg-background text-muted-foreground flex items-center justify-between px-3 py-1 text-xs">
        <div className="flex flex-1 items-center justify-end gap-1">
          <IconButton aria-label="New terminal" size="icon-compact" onClick={handleAddTerminal}>
            <Plus className="size-3.5" />
          </IconButton>
          <IconButton aria-label="Hide terminal" size="icon-compact" onClick={() => setTerminalOpen(false)}>
            <X className="size-3.5" />
          </IconButton>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <ResizablePanelGroup orientation="horizontal" className="h-full" groupRef={splitGroupRef}>
          <ResizablePanel id="terminal-main" defaultSize={hasSessionList ? "78%" : "100%"} minSize="55%">
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
            defaultSize={hasSessionList ? "22%" : "0%"}
            minSize={hasSessionList ? "14%" : "0%"}
            maxSize="40%"
            collapsible={!hasSessionList}
            collapsedSize="0%"
          >
            {hasSessionList ? (
              <ScrollArea className="terminal-panel__list h-full">
                <div className="terminal-panel__list-inner">
                  {sessions.map((session) => (
                    <ListRow
                      key={session.id}
                      selected={session.id === activeSessionIdSafe}
                      muted={session.id !== activeSessionIdSafe}
                      className={cn(
                        "terminal-panel__list-item h-8 px-2 py-1.5",
                        session.id === activeSessionIdSafe && "is-active"
                      )}
                      onClick={() => handleActivateSession(session.id)}
                      label={session.label}
                      labelClassName="text-xs font-medium"
                      trailing={
                        <div className="flex items-center gap-0.5">
                          <IconButton
                            aria-label={`Rename ${session.label}`}
                            size="icon-compact"
                            className={cn(
                              "text-muted-foreground hover:text-foreground h-5 w-5 bg-transparent opacity-0 transition-opacity group-hover:opacity-100 hover:bg-transparent focus-visible:opacity-100 aria-expanded:bg-transparent dark:hover:bg-transparent"
                            )}
                            onClick={(event) => {
                              event.stopPropagation();
                              setRenamingSessionId(session.id);
                            }}
                          >
                            <Pencil className="size-3" />
                          </IconButton>
                          <IconButton
                            aria-label={`Close ${session.label}`}
                            size="icon-compact"
                            className={cn(
                              "text-muted-foreground hover:text-foreground h-5 w-5 bg-transparent opacity-0 transition-opacity group-hover:opacity-100 hover:bg-transparent focus-visible:opacity-100 aria-expanded:bg-transparent dark:hover:bg-transparent"
                            )}
                            onClick={(event) => {
                              event.stopPropagation();
                              handleRemoveSession(session.id);
                            }}
                          >
                            <X className="size-3" />
                          </IconButton>
                        </div>
                      }
                    />
                  ))}
                </div>
              </ScrollArea>
            ) : null}
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
      <InputDialog
        open={Boolean(renamingSession)}
        onOpenChange={(open) => {
          if (!open) setRenamingSessionId(null);
        }}
        title="Rename terminal"
        placeholder="Terminal name"
        defaultValue={renamingSession?.label ?? ""}
        onConfirm={(value) => {
          if (!renamingSession) return;
          handleRenameSession(renamingSession.id, value);
          setRenamingSessionId(null);
        }}
      />
    </section>
  );
}

interface TerminalSessionViewProps {
  sessionId: string;
  isActive: boolean;
}

function TerminalSessionView({ sessionId, isActive }: TerminalSessionViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  useTerminal({ containerRef, isActive });

  return (
    <div
      data-terminal-id={sessionId}
      className={isActive ? "terminal-panel__session is-active" : "terminal-panel__session"}
    >
      <div ref={containerRef} className="h-full w-full overflow-hidden pl-2" />
    </div>
  );
}

interface TerminalSession {
  id: string;
  label: string;
}

function createTerminalSession(index: number): TerminalSession {
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `terminal-${index}`;
  return { id, label: `Terminal ${index}` };
}
