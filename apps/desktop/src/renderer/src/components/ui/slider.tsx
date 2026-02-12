import * as React from "react";
import { Slider as SliderPrimitive } from "@base-ui/react/slider";

import { cn } from "@/lib/utils";

function Slider({ className, defaultValue, value, min = 0, max = 100, ...props }: SliderPrimitive.Root.Props) {
  const _values = React.useMemo(() => {
    if (Array.isArray(value)) return value;
    if (typeof value === "number") return [value];
    if (Array.isArray(defaultValue)) return defaultValue;
    if (typeof defaultValue === "number") return [defaultValue];
    return [min];
  }, [value, defaultValue, min]);

  return (
    <SliderPrimitive.Root
      className={cn("data-horizontal:w-full data-vertical:h-full", className)}
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      thumbAlignment="edge"
      {...props}
    >
      <SliderPrimitive.Control className="relative flex w-full cursor-pointer touch-none items-center select-none data-disabled:opacity-50 data-vertical:h-full data-vertical:min-h-40 data-vertical:w-auto data-vertical:flex-col">
        <SliderPrimitive.Track
          data-slot="slider-track"
          className="bg-muted relative h-1.5 w-full grow overflow-hidden rounded-full select-none data-vertical:h-full data-vertical:w-1.5"
        >
          <SliderPrimitive.Indicator
            data-slot="slider-range"
            className="bg-primary h-full w-full select-none data-vertical:w-full"
          />
        </SliderPrimitive.Track>
        {Array.from({ length: _values.length }, (_, index) => (
          <SliderPrimitive.Thumb
            data-slot="slider-thumb"
            key={index}
            className="border-primary ring-ring/50 block size-4 shrink-0 cursor-grab rounded-full border bg-white shadow-sm transition-[color,box-shadow] select-none hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden active:cursor-grabbing disabled:pointer-events-none disabled:opacity-50"
          />
        ))}
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  );
}

export { Slider };
