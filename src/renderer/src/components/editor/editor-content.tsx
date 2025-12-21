import CodeMirror from "@uiw/react-codemirror";
import { useCodemirrorExtensions } from "./hooks/use-codemirror";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useThemeStore } from "@/stores/use-theme-store";
import { useTranslation } from "react-i18next";

interface EditorContentProps {
  content: string;
  onChange: (content: string) => void;
}

export function EditorContent({ content, onChange }: EditorContentProps) {
  const theme = useThemeStore((state) => state.theme);
  const { extensions, theme: editorTheme } = useCodemirrorExtensions({ isDark: theme === "dark" });
  const { t } = useTranslation("editor");

  return (
    <ScrollArea className="h-full">
      <CodeMirror
        value={content}
        height="auto"
        theme={editorTheme}
        extensions={extensions}
        onChange={onChange}
        placeholder={t("placeholder")}
        basicSetup={{
          lineNumbers: false,
          foldGutter: false,
          highlightActiveLine: false,
          highlightSelectionMatches: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: false
        }}
      />
    </ScrollArea>
  );
}
