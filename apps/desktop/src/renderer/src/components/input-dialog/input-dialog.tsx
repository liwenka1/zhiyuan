import { useState, KeyboardEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslation } from "react-i18next";

interface InputDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  placeholder?: string;
  defaultValue?: string;
  onConfirm: (value: string) => void;
}

// 内部组件，通过 key 重置状态
function InputDialogContent({
  title,
  description,
  placeholder,
  defaultValue = "",
  onConfirm,
  onOpenChange
}: Omit<InputDialogProps, "open">) {
  const [value, setValue] = useState(defaultValue);
  const { t } = useTranslation("ui");

  // 使用翻译后的默认占位符
  const actualPlaceholder = placeholder || t("dialog.placeholder");

  const handleConfirm = () => {
    if (value.trim()) {
      onConfirm(value.trim());
      setValue("");
      onOpenChange(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleConfirm();
    }
  };

  const handleCancel = () => {
    setValue("");
    onOpenChange(false);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {description && <DialogDescription>{description}</DialogDescription>}
      </DialogHeader>
      <div className="grid gap-4 py-4">
        <Input
          className="focus-visible:ring-1"
          placeholder={actualPlaceholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
        />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={handleCancel}>
          {t("dialog.cancel")}
        </Button>
        <Button onClick={handleConfirm} disabled={!value.trim()}>
          {t("dialog.confirm")}
        </Button>
      </DialogFooter>
    </>
  );
}

export function InputDialog({
  open,
  onOpenChange,
  title,
  description,
  placeholder,
  defaultValue = "",
  onConfirm
}: InputDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-106.25">
        {/* 使用 key 在每次打开时重置内部状态 */}
        {open && (
          <InputDialogContent
            key={`${defaultValue}-${open}`}
            title={title}
            description={description}
            placeholder={placeholder}
            defaultValue={defaultValue}
            onConfirm={onConfirm}
            onOpenChange={onOpenChange}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
