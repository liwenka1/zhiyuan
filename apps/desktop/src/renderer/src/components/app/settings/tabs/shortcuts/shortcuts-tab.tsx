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
import { shortcutsMeta, shortcutGroups } from "@/lib/shortcuts-meta";

export function ShortcutsTab() {
  const { t } = useTranslation("common");
  const shortcuts = useShortcutsStore((state) => state.shortcuts);
  const load = useShortcutsStore((state) => state.load);
  const setShortcut = useShortcutsStore((state) => state.setShortcut);
  const resetShortcut = useShortcutsStore((state) => state.resetShortcut);
  const [isRecording, setIsRecording] = useState(false);
  const [pendingBinding, setPendingBinding] = useState<ShortcutBinding | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingShortcutId, setPendingShortcutId] = useState<(typeof shortcutsMeta)[number]["id"] | null>(null);
  const captureRef = useRef<HTMLDivElement>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!dialogOpen) return;
    captureRef.current?.focus();
  }, [dialogOpen]);

  const isMac = useMemo(() => navigator.userAgent.toLowerCase().includes("mac"), []);
  const activeShortcutId = pendingShortcutId ?? "toggleTerminal";
  const activeBinding = shortcuts[activeShortcutId] ?? shortcuts.toggleTerminal;
  const currentBinding = pendingBinding ? pendingBinding : activeBinding;
  const pendingParts = useMemo(() => buildBindingParts(currentBinding, isMac), [currentBinding, isMac]);
  const grouped = useMemo(
    () =>
      shortcutGroups.map((group) => ({
        group,
        items: shortcutsMeta.filter((item) => item.group === group.id)
      })),
    []
  );

  const resetDialogState = () => {
    setIsRecording(false);
    setPendingBinding(null);
  };

  const handleStartRecord = (event: React.MouseEvent<HTMLButtonElement>, id: string) => {
    event.currentTarget.blur();
    setIsRecording(true);
    setPendingBinding(null);
    setPendingShortcutId(id as (typeof shortcutsMeta)[number]["id"]);
    setDialogOpen(true);
  };

  const handleCancelRecord = () => {
    resetDialogState();
    setPendingShortcutId(null);
    setDialogOpen(false);
  };

  const handleReset = (id: string) => {
    resetDialogState();
    void resetShortcut(id as (typeof shortcutsMeta)[number]["id"]);
  };

  const handleConfirm = () => {
    if (!pendingBinding || !pendingShortcutId) return;
    void setShortcut(pendingShortcutId, pendingBinding);
    setPendingBinding(null);
    setPendingShortcutId(null);
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
      setPendingShortcutId(null);
      editButtonRef.current?.blur();
    }
  };

  const handleStartRecordForId = (id: string) => (event: React.MouseEvent<HTMLButtonElement>) =>
    handleStartRecord(event, id);

  return (
    <div>
      {grouped.map(({ group, items }) => (
        <SettingSection key={group.id} title={t(group.labelKey)}>
          {items.map((item) => {
            const binding = shortcuts[item.id] ?? item.default;
            const parts = buildBindingParts(binding, isMac, item.id);
            return (
              <SettingRow key={item.id} label={t(item.labelKey)}>
                <div className="flex flex-wrap items-center gap-2">
                  <KbdGroup>
                    {parts.map((part) => (
                      <Kbd key={part}>{part}</Kbd>
                    ))}
                  </KbdGroup>
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    onClick={handleStartRecordForId(item.id)}
                    aria-pressed={isRecording && pendingShortcutId === item.id}
                    aria-label={t("settings.shortcutsEdit")}
                    ref={editButtonRef}
                  >
                    {isRecording && pendingShortcutId === item.id
                      ? t("settings.shortcutsRecording")
                      : t("settings.shortcutsEdit")}
                  </Button>
                  <Button type="button" size="xs" variant="ghost" onClick={() => handleReset(item.id)}>
                    {t("settings.shortcutsReset")}
                  </Button>
                </div>
              </SettingRow>
            );
          })}
        </SettingSection>
      ))}
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
