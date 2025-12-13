import CodeMirror from "@uiw/react-codemirror";
import { useCodemirrorExtensions } from "./hooks/use-codemirror";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useThemeStore } from "@/stores/use-theme-store";

interface EditorContentProps {
  content: string;
  onChange: (content: string) => void;
}

export function EditorContent({ content, onChange }: EditorContentProps) {
  const theme = useThemeStore((state) => state.theme);
  const { extensions, theme: editorTheme } = useCodemirrorExtensions({ isDark: theme === "dark" });

  return (
    <ScrollArea className="h-full">
      <CodeMirror
        value={content}
        height="auto"
        theme={editorTheme}
        extensions={extensions}
        onChange={onChange}
        placeholder="开始编写你的笔记..."
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
