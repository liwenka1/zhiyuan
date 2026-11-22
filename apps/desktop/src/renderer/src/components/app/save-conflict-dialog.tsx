import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { useNoteStore } from "@/stores/note-store";
import { useSaveConflictStore } from "@/stores/note-store/save-conflicts";

/** Resolving always preserves the draft as a separate note; the external file is never overwritten. */
export function SaveConflictDialog() {
  const { t } = useTranslation("note");
  const conflicts = useSaveConflictStore((state) => state.conflicts);
  const conflict = Object.values(conflicts)[0];
  const [saving, setSaving] = useState(false);
  const resolve = async (saveAs = false) => {
    if (!conflict || saving) return;
    setSaving(true);
    try {
      const resolved = await useNoteStore
        .getState()
        .resolveSaveConflict(
          conflict.filePath,
          saveAs ? t("conflict.saveAs") : undefined,
          t("conflict.existingDraftDestination")
        );
      if (resolved?.originalReadFailed) toast.warning(t("conflict.originalReadFailed"));
      else if (resolved) toast.success(t("conflict.resolved"));
    } catch (error) {
      toast.error(`${t("errors.saveNoteFailed")}: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open={Boolean(conflict)}>
      <DialogContent showCloseButton={false} className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("conflict.title")}</DialogTitle>
          <DialogDescription>{t("conflict.description")}</DialogDescription>
        </DialogHeader>
        {conflict && (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2">
              {t("conflict.local")}
              <textarea
                readOnly
                className="border-border h-56 resize-none rounded-md border p-2 font-mono text-xs"
                value={conflict.localContent}
              />
            </label>
            <label className="grid gap-2">
              {t("conflict.external")}
              <textarea
                readOnly
                className="border-border h-56 resize-none rounded-md border p-2 font-mono text-xs"
                value={conflict.diskContent ?? t("conflict.unavailable")}
              />
            </label>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" disabled={saving} onClick={() => void resolve(true)}>
            {t("conflict.saveAs")}
          </Button>
          <Button disabled={saving} onClick={() => void resolve()}>
            {t("conflict.keepBoth")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
