import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { SettingSection } from "../../shared/setting-section";
import { SettingRow } from "../../shared/setting-row";
import { useShortcutsStore } from "@/stores";
import { Button } from "@/components/ui/button";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { ShortcutRecorderDialog } from "./shortcuts-dialog";
import { buildBindingParts } from "./shortcuts-utils";
import type { ShortcutBinding } from "@shared";

export function ShortcutsTab() {
  const { t } = useTranslation("common");
  const shortcuts = useShortcutsStore((state) => state.shortcuts);
  const load = useShortcutsStore((state) => state.load);
  const setShortcut = useShortcutsStore((state) => state.setShortcut);
  const resetShortcut = useShortcutsStore((state) => state.resetShortcut);
  const [isRecording, setIsRecording] = useState(false);
  const [pendingBinding, setPendingBinding] = useState<ShortcutBinding | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const captureRef = useRef<HTMLDivElement>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!dialogOpen) return;
    captureRef.current?.focus();
  }, [dialogOpen]);

  const currentBinding = shortcuts.toggleTerminal;
  const isMac = useMemo(() => navigator.userAgent.toLowerCase().includes("mac"), []);

  const bindingParts = useMemo(() => buildBindingParts(currentBinding, isMac), [currentBinding, isMac]);
  const pendingParts = useMemo(
    () => (pendingBinding ? buildBindingParts(pendingBinding, isMac) : buildBindingParts(currentBinding, isMac)),
    [pendingBinding, currentBinding, isMac]
  );

  const resetDialogState = () => {
    setIsRecording(false);
    setPendingBinding(null);
  };

  const handleStartRecord = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.currentTarget.blur();
    setIsRecording(true);
    setPendingBinding(null);
    setDialogOpen(true);
  };

  const handleCancelRecord = () => {
    resetDialogState();
    setDialogOpen(false);
  };

  const handleReset = () => {
    resetDialogState();
    void resetShortcut("toggleTerminal");
  };

  const handleConfirm = () => {
    if (!pendingBinding) return;
    void setShortcut("toggleTerminal", pendingBinding);
    setPendingBinding(null);
    setDialogOpen(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" && pendingBinding) {
      event.preventDefault();
      event.stopPropagation();
      handleConfirm();
      return;
    }

    if (!isRecording) return;
    event.preventDefault();
    event.stopPropagation();

    if (event.key === "Escape") {
      handleCancelRecord();
      return;
    }

    const code = event.code;
    if (!code) {
      return;
    }

    if (
      code === "ShiftLeft" ||
      code === "ShiftRight" ||
      code === "ControlLeft" ||
      code === "ControlRight" ||
      code === "AltLeft" ||
      code === "AltRight" ||
      code === "MetaLeft" ||
      code === "MetaRight"
    ) {
      return;
    }

    const next = {
      code,
      ctrl: event.ctrlKey,
      shift: event.shiftKey,
      alt: event.altKey,
      meta: event.metaKey
    };

    setIsRecording(false);
    setPendingBinding(next);
  };

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      resetDialogState();
      editButtonRef.current?.blur();
    }
  };

  return (
    <div>
      <SettingSection title={t("settings.shortcutsSectionTitle")}>
        <SettingRow label={t("settings.shortcutsToggleTerminal")}>
          <div className="flex flex-wrap items-center gap-2">
            <KbdGroup>
              {bindingParts.map((part) => (
                <Kbd key={part}>{part}</Kbd>
              ))}
            </KbdGroup>
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={handleStartRecord}
              aria-pressed={isRecording}
              aria-label={t("settings.shortcutsEdit")}
              ref={editButtonRef}
            >
              {isRecording ? t("settings.shortcutsRecording") : t("settings.shortcutsEdit")}
            </Button>
            <Button type="button" size="xs" variant="ghost" onClick={handleReset}>
              {t("settings.shortcutsReset")}
            </Button>
          </div>
        </SettingRow>
      </SettingSection>
      <ShortcutRecorderDialog
        open={dialogOpen}
        onOpenChange={handleDialogOpenChange}
        onKeyDown={handleKeyDown}
        onStart={() => {
          setIsRecording(true);
          setPendingBinding(null);
        }}
        onCancel={handleCancelRecord}
        onConfirm={handleConfirm}
        captureRef={captureRef}
        title={t("settings.shortcutsDialogTitle")}
        description={t("settings.shortcutsRecordingHint")}
        idleText={t("settings.shortcutsDialogIdle")}
        listeningText={t("settings.shortcutsDialogListening")}
        pendingLabel={t("settings.shortcutsDialogPending")}
        currentLabel={t("settings.shortcutsDialogCurrent")}
        confirmLabel={t("settings.shortcutsConfirm")}
        cancelLabel={t("settings.shortcutsCancel")}
        isRecording={isRecording}
        pendingBinding={pendingBinding}
        parts={pendingParts}
      />
    </div>
  );
}
