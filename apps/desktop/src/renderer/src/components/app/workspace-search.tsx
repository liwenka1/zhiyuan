import { Combobox } from "@base-ui/react/combobox";
import { FileText, Folder, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { useFolderStore, useNoteStore, useWorkspaceStore } from "@/stores";
import { findWorkspaceSearchResults, type WorkspaceSearchResult } from "./workspace-search-matches";

interface WorkspaceSearchProps {
  onSelectFolder: (folderId: string) => void;
  onSelectNote: (noteId: string) => void;
  focusRequest?: number;
  disabled?: boolean;
}

const NO_DRAG = { WebkitAppRegion: "no-drag" } as CSSProperties;

export function WorkspaceSearch({ disabled = false, ...props }: WorkspaceSearchProps) {
  const revision = useWorkspaceStore((state) => state.revision);
  const unavailable = useWorkspaceStore((state) => !state.workspacePath || state.isLoading);
  const searchDisabled = disabled || unavailable;

  return (
    <WorkspaceSearchInput
      key={`${revision}:${searchDisabled}`}
      {...props}
      disabled={searchDisabled}
      revision={revision}
    />
  );
}

function WorkspaceSearchInput({
  onSelectFolder,
  onSelectNote,
  focusRequest = 0,
  disabled = false,
  revision
}: WorkspaceSearchProps & { revision: number }) {
  const { t } = useTranslation("common");
  const folders = useFolderStore((state) => state.folders);
  const notes = useNoteStore((state) => state.notes);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const lastFocusRequest = useRef(focusRequest);
  const isComposing = useRef(false);
  const open = !disabled && query.trim().length > 0;

  const groups = useMemo(() => {
    if (!open) return [];
    const matches = findWorkspaceSearchResults(folders, notes, query);
    const folderGroup = { id: "folders", items: matches.folders };
    const fileGroup = { id: "files", items: matches.files };
    return (matches.filesFirst ? [fileGroup, folderGroup] : [folderGroup, fileGroup]).filter(
      ({ items }) => items.length > 0
    );
  }, [folders, notes, open, query]);

  useEffect(() => {
    if (lastFocusRequest.current === focusRequest) return;
    lastFocusRequest.current = focusRequest;
    if (disabled) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [disabled, focusRequest]);

  const selectResult = (result: WorkspaceSearchResult | null) => {
    const workspace = useWorkspaceStore.getState();
    if (!result || disabled || workspace.isLoading || workspace.revision !== revision) return;

    setQuery("");
    if (result.kind === "folder") {
      onSelectFolder(result.id);
    } else {
      onSelectNote(result.id);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (isComposing.current || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) {
      // Let the input method handle these keys before the result list sees them.
      event.stopPropagation();
      return;
    }
    if (event.key !== "Escape") return;

    event.preventDefault();
    event.stopPropagation();
    setQuery("");
    const previousFocus = previousFocusRef.current;
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    if (document.activeElement === inputRef.current) inputRef.current?.blur();
  };

  return (
    <Combobox.Root<WorkspaceSearchResult>
      items={groups}
      filter={null}
      open={open}
      openOnInputClick={false}
      disabled={disabled}
      inputValue={disabled ? "" : query}
      value={null}
      autoHighlight
      onInputValueChange={(value, details) => {
        if (details.reason === "input-change" || details.reason === "input-clear") setQuery(value);
      }}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) setQuery("");
      }}
      onValueChange={selectResult}
    >
      <div className="relative w-full min-w-0" style={NO_DRAG}>
        <Search
          aria-hidden="true"
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
        />
        <Combobox.Input
          ref={inputRef}
          aria-label={t("workspaceSearch.placeholder")}
          placeholder={t("workspaceSearch.placeholder")}
          className="border-border bg-muted/50 text-foreground placeholder:text-muted-foreground focus-visible:border-ring h-7 w-full min-w-0 rounded-md border py-1 pr-2.5 pl-8 text-sm transition-colors outline-none disabled:opacity-50"
          onFocus={(event) => {
            previousFocusRef.current = event.relatedTarget instanceof HTMLElement ? event.relatedTarget : null;
          }}
          onCompositionStart={() => {
            isComposing.current = true;
          }}
          onCompositionEnd={() => {
            isComposing.current = false;
          }}
          onKeyDownCapture={handleKeyDown}
        />
      </div>

      <Combobox.Portal>
        <Combobox.Positioner sideOffset={14} className="z-40 w-(--anchor-width)" style={NO_DRAG}>
          <Combobox.Popup
            initialFocus={false}
            finalFocus={false}
            className="border-border bg-popover text-popover-foreground max-h-[min(26rem,var(--available-height))] overflow-y-auto rounded-lg border p-1 shadow-md"
          >
            <Combobox.Empty className="px-2.5 py-2 text-sm empty:hidden">
              {t("workspaceSearch.noResults")}
            </Combobox.Empty>
            {/* Re-register item order when a more exact match moves its group to the top. */}
            <Combobox.List key={groups[0]?.id}>
              {(group: (typeof groups)[number]) => (
                <Combobox.Group key={group.id} items={group.items}>
                  <Combobox.GroupLabel className="text-muted-foreground px-2.5 pt-2 pb-1 text-xs font-medium">
                    {t(group.id === "folders" ? "workspaceSearch.folders" : "workspaceSearch.files")}
                  </Combobox.GroupLabel>
                  <Combobox.Collection>
                    {(result: WorkspaceSearchResult) => {
                      const Icon = result.kind === "folder" ? Folder : FileText;
                      return (
                        <Combobox.Item
                          key={result.id}
                          value={result}
                          title={result.id}
                          className="data-highlighted:bg-accent data-highlighted:text-accent-foreground flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm outline-none"
                        >
                          <Icon aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
                          <span className="min-w-0">
                            <span className="block truncate">{result.name}</span>
                            {result.id !== result.name && (
                              <span className="text-muted-foreground block truncate text-xs">{result.id}</span>
                            )}
                          </span>
                        </Combobox.Item>
                      );
                    }}
                  </Combobox.Collection>
                </Combobox.Group>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
