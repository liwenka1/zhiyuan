import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { SettingSection } from "../../shared/setting-section";
import { SettingRow } from "../../shared/setting-row";
import { useShortcutsStore } from "@/stores";
import { Button } from "@/components/ui/button";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { ShortcutRecorderDialog } from "./shortcuts-dialog";
import { buildBindingParts } from "./shortcuts-utils";
import {
  findShortcutConflict,
  getReservedMenuShortcuts,
  getShortcutBindingKey,
  resolveLabel,
  type ShortcutBinding,
  type ShortcutId,
  type MenuLocale
} from "@shared";
import { shortcutsMeta, shortcutGroups, shortcutsMetaById } from "@/lib/shortcuts-meta";

export function ShortcutsTab() {
  const { t, i18n } = useTranslation("common");
  const shortcuts = useShortcutsStore((state) => state.shortcuts);
  const load = useShortcutsStore((state) => state.load);
  const setShortcut = useShortcutsStore((state) => state.setShortcut);
  const resetShortcut = useShortcutsStore((state) => state.resetShortcut);
  const [isRecording, setIsRecording] = useState(false);
  const [pendingBinding, setPendingBinding] = useState<ShortcutBinding | null>(null);
  const [pendingShortcutId, setPendingShortcutId] = useState<ShortcutId | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const captureRef = useRef<HTMLDivElement>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    void load();
  }, [load]);

  const isMac = useMemo(() => navigator.userAgent.toLowerCase().includes("mac"), []);
  const activeShortcutId = pendingShortcutId ?? "toggleTerminal";
  const activeBinding = shortcuts[activeShortcutId] ?? shortcuts.toggleTerminal;
  const currentBinding = pendingBinding ? pendingBinding : activeBinding;
  const pendingParts = useMemo(
    () => buildBindingParts(currentBinding, isMac, activeShortcutId),
    [activeShortcutId, currentBinding, isMac]
  );
  const shortcutPlatform = isMac ? "mac" : "default";
  const menuShortcutPlatform = isMac ? "mac" : "win";
  const menuLocale: MenuLocale = i18n.language.startsWith("zh") ? "zh" : "en";
  const conflictShortcutId = useMemo(() => {
    if (!pendingBinding || !pendingShortcutId) return null;
    return findShortcutConflict(shortcuts, pendingShortcutId, pendingBinding, shortcutPlatform);
  }, [pendingBinding, pendingShortcutId, shortcutPlatform, shortcuts]);
  const reservedMenuConflict = useMemo(() => {
    if (!pendingBinding || !pendingShortcutId) return null;
    const targetKey = getShortcutBindingKey(pendingBinding, pendingShortcutId, shortcutPlatform);
    return getReservedMenuShortcuts(menuShortcutPlatform).find((item) => item.key === targetKey) ?? null;
  }, [menuShortcutPlatform, pendingBinding, pendingShortcutId, shortcutPlatform]);
  const conflictMessage = conflictShortcutId
    ? t("settings.shortcutsConflict", {
        action: t(shortcutsMetaById.get(conflictShortcutId)?.labelKey ?? conflictShortcutId)
      })
    : reservedMenuConflict
      ? t("settings.shortcutsReservedConflict", {
          action: resolveLabel(reservedMenuConflict.label, menuLocale)
        })
      : null;
  const canConfirm = Boolean(pendingBinding && pendingShortcutId && !conflictMessage && !isSaving);
  const grouped = useMemo(
    () =>
      shortcutGroups.map((group) => ({
        group,
        items: shortcutsMeta.filter((item) => item.group === group.id)
      })),
    []
  );

  const startRecording = () => {
    if (isSaving) return;
    setIsRecording(true);
    setPendingBinding(null);
    setSaveFailed(false);
  };

  const handleStartRecord = (event: React.MouseEvent<HTMLButtonElement>, id: ShortcutId) => {
    editButtonRef.current = event.currentTarget;
    setPendingShortcutId(id);
    startRecording();
  };

  const closeRecorder = () => {
    setIsRecording(false);
    setPendingBinding(null);
    setPendingShortcutId(null);
    setSaveFailed(false);
  };

  const handleReset = async (id: ShortcutId) => {
    if (!(await resetShortcut(id))) toast.error(t("settings.shortcutsSaveFailed"));
  };

  const handleConfirm = async () => {
    if (!canConfirm || !pendingShortcutId || !pendingBinding) return;
    setIsSaving(true);
    setSaveFailed(false);
    const saved = await setShortcut(pendingShortcutId, pendingBinding);
    setIsSaving(false);
    if (saved) {
      closeRecorder();
    } else {
      setSaveFailed(true);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" && pendingBinding) {
      event.preventDefault();
      event.stopPropagation();
      if (!event.repeat && !event.nativeEvent.isComposing) void handleConfirm();
      return;
    }

    if (!isRecording || event.nativeEvent.isComposing) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.repeat) return;

    if (event.key === "Escape") {
      closeRecorder();
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
                    onClick={(event) => handleStartRecord(event, item.id)}
                    aria-pressed={isRecording && pendingShortcutId === item.id}
                    aria-label={t("settings.shortcutsEdit")}
                  >
                    {isRecording && pendingShortcutId === item.id
                      ? t("settings.shortcutsRecording")
                      : t("settings.shortcutsEdit")}
                  </Button>
                  <Button type="button" size="xs" variant="ghost" onClick={() => void handleReset(item.id)}>
                    {t("settings.shortcutsReset")}
                  </Button>
                </div>
              </SettingRow>
            );
          })}
        </SettingSection>
      ))}
      <ShortcutRecorderDialog
        open={pendingShortcutId !== null}
        onOpenChange={(open) => {
          if (!open && !isSaving) closeRecorder();
        }}
        onKeyDown={handleKeyDown}
        onStart={startRecording}
        onCancel={closeRecorder}
        onConfirm={() => void handleConfirm()}
        captureRef={captureRef}
        editButtonRef={editButtonRef}
        title={t("settings.shortcutsDialogTitle")}
        description={t("settings.shortcutsRecordingHint")}
        idleText={t("settings.shortcutsDialogIdle")}
        listeningText={t("settings.shortcutsDialogListening")}
        pendingLabel={t("settings.shortcutsDialogPending")}
        currentLabel={t("settings.shortcutsDialogCurrent")}
        confirmLabel={t("settings.shortcutsConfirm")}
        cancelLabel={t("settings.shortcutsCancel")}
        isRecording={isRecording}
        isSaving={isSaving}
        hasPendingBinding={pendingBinding !== null}
        canConfirm={canConfirm}
        parts={pendingParts}
        errorText={conflictMessage ?? (saveFailed ? t("settings.shortcutsSaveFailed") : undefined)}
      />
    </div>
  );
}
