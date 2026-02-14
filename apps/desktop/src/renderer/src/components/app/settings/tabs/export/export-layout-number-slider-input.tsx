import { startTransition, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { usePreventWheelScroll } from "./use-prevent-wheel-scroll";

interface ExportLayoutNumberSliderInputProps {
  value: number;
  min: number;
  max: number;
  ariaLabel: string;
  unit?: string;
  onChange: (next: number) => void;
}

export function ExportLayoutNumberSliderInput({
  value,
  min,
  max,
  ariaLabel,
  unit,
  onChange
}: ExportLayoutNumberSliderInputProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  usePreventWheelScroll(containerRef);

  const [draft, setDraft] = useState<string | null>(null);
  const [sliderValue, setSliderValue] = useState(value);
  const editing = draft !== null;
  const displayValue = editing ? draft : String(sliderValue);

  useEffect(() => {
    if (!editing) {
      startTransition(() => {
        setSliderValue(value);
      });
    }
  }, [value, editing]);

  const commit = () => {
    if (draft === null) return;
    const parsed = Number(draft);
    setDraft(null);
    if (Number.isNaN(parsed) || draft.trim() === "") return;
    const clamped = Math.round(Math.min(max, Math.max(min, parsed)));
    setSliderValue(clamped);
    onChange(clamped);
  };

  return (
    <div ref={containerRef} className="flex w-full items-center gap-3">
      <Slider
        value={sliderValue}
        min={min}
        max={max}
        step={1}
        orientation="horizontal"
        onValueChange={(next) => {
          const raw = Array.isArray(next) ? next[0] : next;
          if (typeof raw === "number" && !Number.isNaN(raw)) {
            setSliderValue(raw);
          }
        }}
        onValueCommitted={(next) => {
          const raw = Array.isArray(next) ? next[0] : next;
          if (typeof raw === "number" && !Number.isNaN(raw)) {
            onChange(raw);
          }
        }}
        className="**:data-[slot=slider-range]:bg-primary **:data-[slot=slider-thumb]:border-primary **:data-[slot=slider-thumb]:bg-background **:data-[slot=slider-track]:bg-muted/80 flex-1"
        aria-label={ariaLabel}
      />

      <div className="flex items-center gap-1">
        <Input
          type="text"
          value={displayValue}
          onFocus={(e) => setDraft(e.currentTarget.value)}
          onChange={(e) => setDraft(e.currentTarget.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.currentTarget.blur();
            }
          }}
          className="h-9 w-20 text-center text-sm"
        />
        {unit ? <Label className="text-muted-foreground w-6 text-xs font-normal">{unit}</Label> : null}
      </div>
    </div>
  );
}
