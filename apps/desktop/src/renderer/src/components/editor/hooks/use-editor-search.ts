import { useState, useCallback, useEffect, useRef } from "react";
import { EditorView } from "@codemirror/view";
import { SearchQuery, findNext, findPrevious, replaceNext, replaceAll, setSearchQuery } from "@codemirror/search";
import { useDebounce } from "ahooks";

export interface SearchState {
  isOpen: boolean;
  searchText: string;
  replaceText: string;
  showReplace: boolean;
  matchCount: number;
  currentMatch: number;
}

export interface UseEditorSearchReturn {
  state: SearchState;
  open: () => void;
  close: () => void;
  setSearchText: (text: string) => void;
  setReplaceText: (text: string) => void;
  toggleReplace: () => void;
  findNext: () => void;
  findPrevious: () => void;
  replace: () => void;
  replaceAll: () => void;
}

export function useEditorSearch(view: EditorView | null): UseEditorSearchReturn {
  const [state, setState] = useState<SearchState>({
    isOpen: false,
    searchText: "",
    replaceText: "",
    showReplace: false,
    matchCount: 0,
    currentMatch: 0
  });

  // 防抖搜索文本
  const debouncedSearchText = useDebounce(state.searchText, { wait: 150 });
  const prevSearchTextRef = useRef("");

  // 计算匹配数量和当前索引
  const updateMatchCount = useCallback(
    (searchText: string) => {
      if (!view || !searchText) {
        setState((prev) => ({ ...prev, matchCount: 0, currentMatch: 0 }));
        return;
      }

      const query = new SearchQuery({
        search: searchText,
        caseSensitive: false,
        literal: true
      });

      const cursor = query.getCursor(view.state.doc);
      const selection = view.state.selection.main;
      let count = 0;
      let currentIndex = 0;

      let result = cursor.next();
      while (!result.done) {
        count++;
        // 精确匹配选中区域
        if (result.value.from === selection.from && result.value.to === selection.to) {
          currentIndex = count;
        }
        result = cursor.next();
      }

      setState((prev) => ({
        ...prev,
        matchCount: count,
        currentMatch: currentIndex || (count > 0 ? 1 : 0)
      }));
    },
    [view]
  );

  // 选中第一个匹配项
  const selectFirstMatch = useCallback(
    (searchText: string) => {
      if (!view || !searchText) return;

      const query = new SearchQuery({
        search: searchText,
        caseSensitive: false,
        literal: true
      });

      const cursor = query.getCursor(view.state.doc);
      const result = cursor.next();

      if (!result.done) {
        const match = result.value;
        view.dispatch({
          selection: { anchor: match.from, head: match.to },
          scrollIntoView: true
        });
      }
    },
    [view]
  );

  // 当搜索文本变化时更新查询
  useEffect(() => {
    if (!view || !state.isOpen) return;

    const query = new SearchQuery({
      search: debouncedSearchText,
      replace: state.replaceText,
      caseSensitive: false,
      literal: true
    });

    view.dispatch({ effects: setSearchQuery.of(query) });

    // 搜索文本变化时跳转到第一个匹配项
    if (debouncedSearchText && debouncedSearchText !== prevSearchTextRef.current) {
      requestAnimationFrame(() => {
        selectFirstMatch(debouncedSearchText);
        requestAnimationFrame(() => updateMatchCount(debouncedSearchText));
      });
    } else {
      updateMatchCount(debouncedSearchText);
    }

    prevSearchTextRef.current = debouncedSearchText;
  }, [view, debouncedSearchText, state.isOpen, updateMatchCount, state.replaceText, selectFirstMatch]);

  const open = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: true }));
    if (view) {
      const selection = view.state.selection.main;
      if (!selection.empty) {
        const selectedText = view.state.sliceDoc(selection.from, selection.to);
        if (selectedText && !selectedText.includes("\n")) {
          setState((prev) => ({ ...prev, isOpen: true, searchText: selectedText }));
        }
      }
    }
  }, [view]);

  const close = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isOpen: false,
      matchCount: 0,
      currentMatch: 0
    }));
    if (view) {
      const query = new SearchQuery({ search: "" });
      view.dispatch({ effects: setSearchQuery.of(query) });
      view.focus();
    }
  }, [view]);

  const setSearchText = useCallback((text: string) => {
    setState((prev) => ({ ...prev, searchText: text }));
  }, []);

  const setReplaceText = useCallback((text: string) => {
    setState((prev) => ({ ...prev, replaceText: text }));
  }, []);

  const toggleReplace = useCallback(() => {
    setState((prev) => ({ ...prev, showReplace: !prev.showReplace }));
  }, []);

  // 滚动选中项到视口中心
  const scrollSelectionToCenter = useCallback(() => {
    if (!view) return;
    const selection = view.state.selection.main;
    view.dispatch({
      effects: EditorView.scrollIntoView(selection.from, { y: "center" })
    });
  }, [view]);

  const handleFindNext = useCallback(() => {
    if (!view || !state.searchText) return;
    findNext(view);
    requestAnimationFrame(() => {
      scrollSelectionToCenter();
      updateMatchCount(state.searchText);
    });
  }, [view, state.searchText, updateMatchCount, scrollSelectionToCenter]);

  const handleFindPrevious = useCallback(() => {
    if (!view || !state.searchText) return;
    findPrevious(view);
    requestAnimationFrame(() => {
      scrollSelectionToCenter();
      updateMatchCount(state.searchText);
    });
  }, [view, state.searchText, updateMatchCount, scrollSelectionToCenter]);

  const handleReplace = useCallback(() => {
    if (!view || !state.searchText) return;
    replaceNext(view);
    requestAnimationFrame(() => updateMatchCount(state.searchText));
  }, [view, state.searchText, updateMatchCount]);

  const handleReplaceAll = useCallback(() => {
    if (!view || !state.searchText) return;
    replaceAll(view);
    requestAnimationFrame(() => updateMatchCount(state.searchText));
  }, [view, state.searchText, updateMatchCount]);

  return {
    state,
    open,
    close,
    setSearchText,
    setReplaceText,
    toggleReplace,
    findNext: handleFindNext,
    findPrevious: handleFindPrevious,
    replace: handleReplace,
    replaceAll: handleReplaceAll
  };
}
