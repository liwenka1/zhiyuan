interface EditorContentProps {
  content: string;
  onChange: (content: string) => void;
}

export function EditorContent({ content, onChange }: EditorContentProps) {
  return (
    <div className="flex-1 overflow-hidden">
      <textarea
        className="bg-background text-foreground h-full w-full resize-none p-4 font-mono text-sm leading-relaxed outline-none"
        value={content}
        onChange={(e) => onChange(e.target.value)}
        placeholder="开始编写你的笔记..."
      />
    </div>
  );
}
