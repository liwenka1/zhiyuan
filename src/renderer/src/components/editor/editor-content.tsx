import CodeMirror from "@uiw/react-codemirror";
import { useCodemirrorExtensions } from "./hooks/use-codemirror";

interface EditorContentProps {
  content: string;
  onChange: (content: string) => void;
}

export function EditorContent({ content, onChange }: EditorContentProps) {
  const { extensions, theme } = useCodemirrorExtensions({ isDark: false });

  return (
    <div className="h-full overflow-hidden">
      <CodeMirror
        value={content}
        height="100%"
        theme={theme}
        extensions={extensions}
        onChange={onChange}
        placeholder="开始编写你的笔记..."
        className="h-full"
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
    </div>
  );
}
