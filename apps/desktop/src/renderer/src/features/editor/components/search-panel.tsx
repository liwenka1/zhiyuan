import { useEffect, useRef } from "react";
import { ChevronUp, ChevronDown, X, Replace } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslation } from "react-i18next";
import type { UseEditorSearchReturn } from "../hooks/use-editor-search";

interface SearchPanelProps {
  search: UseEditorSearchReturn;
}

export function SearchPanel({ search }: SearchPanelProps) {
  const { t } = useTranslation("editor");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const wasOpenRef = useRef(false);
  const { state, close, setSearchText, setReplaceText, toggleReplace, findNext, findPrevious, replace, replaceAll } =
    search;

  // 仅在首次打开时聚焦并全选
  useEffect(() => {
    if (state.isOpen && !wasOpenRef.current && searchInputRef.current) {
      searchInputRef.current.focus();
      searchInputRef.current.select();
    }
    wasOpenRef.current = state.isOpen;
  }, [state.isOpen]);

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) {
        findPrevious();
      } else {
        findNext();
      }
    }
  };

  if (!state.isOpen) {
    return null;
  }

  return (
    <div
      className="bg-background absolute top-2 right-4 z-50 rounded-lg border p-2 shadow-md"
      onKeyDown={handleKeyDown}
    >
      {/* 搜索行 */}
      <div className="flex items-center gap-1.5">
        <Input
          ref={searchInputRef}
          className="h-8 w-48 focus-visible:ring-1"
          placeholder={t("search.placeholder")}
          value={state.searchText}
          onChange={(e) => setSearchText(e.target.value)}
          onFocus={(e) => {
            // 聚焦时将光标移到文本末尾
            const len = e.target.value.length;
            e.target.setSelectionRange(len, len);
          }}
        />
        <span className="text-muted-foreground min-w-14 text-center text-xs">
          {state.searchText ? `${state.currentMatch}/${state.matchCount}` : ""}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={findPrevious}
          disabled={!state.searchText || state.matchCount === 0}
          title={t("search.previous")}
        >
          <ChevronUp className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={findNext}
          disabled={!state.searchText || state.matchCount === 0}
          title={t("search.next")}
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={`h-7 w-7 p-0 ${state.showReplace ? "bg-muted text-foreground" : ""}`}
          onClick={toggleReplace}
          title={t("search.toggleReplace")}
        >
          <Replace className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={close} title={t("search.close")}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* 替换行 */}
      {state.showReplace && (
        <div className="mt-2 flex items-center gap-1.5">
          <Input
            className="h-8 w-48 focus-visible:ring-1"
            placeholder={t("search.replacePlaceholder")}
            value={state.replaceText}
            onChange={(e) => setReplaceText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (e.shiftKey) {
                  replaceAll();
                } else {
                  replace();
                }
              }
            }}
          />
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={replace}
            disabled={!state.searchText || state.matchCount === 0}
          >
            {t("search.replace")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={replaceAll}
            disabled={!state.searchText || state.matchCount === 0}
          >
            {t("search.replaceAll")}
          </Button>
        </div>
      )}
    </div>
  );
}
