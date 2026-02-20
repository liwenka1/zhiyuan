import { Button } from "@/components/ui/button";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import type { ShortcutBinding } from "@shared";

function ShortcutKeys({ parts }: { parts: string[] }) {
  return (
    <KbdGroup>
      {parts.map((part) => (
        <Kbd key={part}>{part}</Kbd>
      ))}
    </KbdGroup>
  );
}

export function ShortcutRecorderDialog({
  open,
  title,
  description,
  idleText,
  listeningText,
  pendingLabel,
  currentLabel,
  confirmLabel,
  cancelLabel,
  isRecording,
  pendingBinding,
  parts,
  onOpenChange,
  onKeyDown,
  onStart,
  onCancel,
  onConfirm,
  captureRef
}: {
  open: boolean;
  title: string;
  description: string;
  idleText: string;
  listeningText: string;
  pendingLabel: string;
  currentLabel: string;
  confirmLabel: string;
  cancelLabel: string;
  isRecording: boolean;
  pendingBinding: ShortcutBinding | null;
  parts: string[];
  onOpenChange: (open: boolean) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  onStart: () => void;
  onCancel: () => void;
  onConfirm: () => void;
  captureRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div
          ref={captureRef}
          tabIndex={0}
          onKeyDown={onKeyDown}
          onClick={onStart}
          className="border-border bg-muted/40 text-foreground focus-visible:ring-ring/50 flex min-h-24 items-center justify-center rounded-lg border text-sm outline-none focus-visible:ring-[3px]"
        >
          {isRecording ? listeningText : idleText}
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">{pendingBinding ? pendingLabel : currentLabel}</span>
          <ShortcutKeys parts={parts} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button onClick={onConfirm} disabled={!pendingBinding}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
