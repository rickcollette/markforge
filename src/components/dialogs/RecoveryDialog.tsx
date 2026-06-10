import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Trash2, X } from "lucide-react";

import { toastError, useAppStore } from "@/state/appStore";
import { useDocumentStore } from "@/state/documentStore";
import * as backend from "@/lib/tauri/commands";
import type { RecoverySnapshot } from "@/lib/types";

export default function RecoveryDialog() {
  const open = useAppStore((s) => s.activeDialog === "recovery");
  const closeDialog = useAppStore((s) => s.closeDialog);
  const toast = useAppStore((s) => s.toast);
  const newDocument = useDocumentStore((s) => s.newDocument);
  const [snapshots, setSnapshots] = useState<RecoverySnapshot[]>([]);

  const refresh = async () => {
    try {
      setSnapshots(await backend.listRecoverySnapshots());
    } catch {
      setSnapshots([]);
    }
  };

  useEffect(() => {
    if (open) void refresh();
  }, [open]);

  const restore = async (snapshot: RecoverySnapshot) => {
    try {
      const content = await backend.restoreRecoverySnapshot(snapshot.id);
      // Never silently overwrite: recovered content opens as a new tab.
      newDocument(content, `${snapshot.title ?? "Recovered"} (recovered)`);
      toast({ kind: "success", title: "Snapshot restored into a new tab" });
      closeDialog();
    } catch (err) {
      toastError("Could not restore snapshot", err);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && closeDialog()}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content">
          <div
            className="flex items-center justify-between border-b px-4 py-3"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            <Dialog.Title className="text-sm font-semibold">
              Recovery Snapshots
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="icon-btn" aria-label="Close recovery manager">
                <X size={15} />
              </button>
            </Dialog.Close>
          </div>
          <Dialog.Description
            className="px-4 pt-2 text-[11px]"
            style={{ color: "var(--text-muted)" }}
          >
            Automatic crash-safety snapshots of unsaved work. Restoring opens
            the snapshot in a new tab — nothing is overwritten.
          </Dialog.Description>
          <div className="max-h-80 overflow-y-auto p-3">
            {snapshots.length === 0 && (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                No snapshots stored.
              </p>
            )}
            {snapshots.map((s) => (
              <div
                key={s.id}
                className="mb-1.5 flex items-center gap-2 rounded-lg border p-2.5"
                style={{ borderColor: "var(--border-subtle)" }}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-semibold">
                    {s.title ?? s.path ?? "Untitled"}
                  </div>
                  <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                    {new Date(s.createdAt).toLocaleString()} ·{" "}
                    {(s.size / 1024).toFixed(1)} KB
                  </div>
                </div>
                <button className="btn btn-primary" onClick={() => void restore(s)}>
                  Restore
                </button>
                <button
                  className="icon-btn"
                  aria-label="Delete snapshot"
                  onClick={async () => {
                    await backend.deleteRecoverySnapshot(s.id).catch(() => {});
                    void refresh();
                  }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
