import CodeMirror from "@uiw/react-codemirror";
import { useCodemirrorExtensions } from "./hooks/use-codemirror";
import { ScrollArea } from "@/components/ui/scroll-area";

interface EditorContentProps {
  content: string;
  onChange: (content: string) => void;
}

export function EditorContent({ content, onChange }: EditorContentProps) {
  const { extensions, theme } = useCodemirrorExtensions({ isDark: false });

  return (
    <ScrollArea className="h-full">
      <CodeMirror
        value={content}
        height="auto"
        theme={theme}
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
