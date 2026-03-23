import { Input } from "@/components/ui/input";

function toColorInputValue(value: string): string {
  return /^#([0-9a-fA-F]{3,8})$/.test(value) ? value : "#000000";
}

interface ExportLayoutColorInputProps {
  value: string;
  onChange: (next: string) => void;
}

export function ExportLayoutColorInput({ value, onChange }: ExportLayoutColorInputProps) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={toColorInputValue(value)}
        onChange={(e) => onChange(e.currentTarget.value)}
        className="h-9 w-11 cursor-pointer rounded-md border border-input bg-background p-1 shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
      />
      <Input
        type="text"
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
        className="h-9 w-28 font-mono text-sm uppercase"
      />
    </div>
  );
}
