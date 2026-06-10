import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getCurrentWebview } from "@tauri-apps/api/webview";

import AppShell from "@/components/layout/AppShell";
import { registerAllCommands } from "@/lib/commands/appCommands";
import { handleKeydown } from "@/lib/commands/keymap";
import { restoreSession, startSessionPersistence } from "@/lib/session";
import * as backend from "@/lib/tauri/commands";
import { useSettingsStore, applyThemeToDom } from "@/state/settingsStore";
import { useDocumentStore } from "@/state/documentStore";
import { useWorkspaceStore } from "@/state/workspaceStore";
import { useAppStore } from "@/state/appStore";

registerAllCommands();

// Module-level so StrictMode's double effect invocation can't boot twice.
let hasBooted = false;

export default function App() {
  useEffect(() => {
    if (hasBooted) return;
    hasBooted = true;

    const boot = async () => {
      applyThemeToDom(useSettingsStore.getState().settings);
      await useSettingsStore.getState().load();
      await Promise.all([
        useDocumentStore.getState().loadRecents(),
        useWorkspaceStore.getState().loadRecents(),
      ]);

      const settings = useSettingsStore.getState().settings;
      if (settings.files.restoreLastSession) {
        await restoreSession().catch(() => {});
      }

      // Files opened via file association / "Open with" on first launch.
      try {
        const startupFiles = await backend.takeStartupFiles();
        for (const path of startupFiles) {
          await useDocumentStore.getState().openPath(path, { allow: true });
        }
      } catch {
        /* not running inside Tauri */
      }

      // Offer crash recovery when snapshots exist (never silently restore).
      try {
        const snapshots = await backend.listRecoverySnapshots();
        if (snapshots.length > 0) {
          useAppStore.getState().toast({
            kind: "warning",
            title: `${snapshots.length} unsaved snapshot(s) found`,
            detail: "Open Tools → Backup Manager to review and restore them.",
          });
        }
      } catch {
        /* recovery dir unavailable */
      }

      startSessionPersistence();
    };
    void boot();
  }, []);

  // Listeners are attached on every mount (unlike boot) so StrictMode's
  // unmount/remount cycle doesn't leave the app without a keydown handler.
  useEffect(() => {
    // Global keyboard shortcuts.
    const onKeydown = (e: KeyboardEvent) => handleKeydown(e);
    window.addEventListener("keydown", onKeydown, { capture: true });

    // Native file drag & drop -> open markdown files. Guarded so the app
    // still boots in a plain browser (E2E tests).
    let unlistenDrop: (() => void) | undefined;
    let unlistenClose: (() => void) | undefined;
    let unlistenOpenFiles: (() => void) | undefined;
    try {
      // Files forwarded from secondary launches (file associations) while
      // the app is already running.
      void listen<string[]>("app://open-files", (event) => {
        for (const path of event.payload) {
          void useDocumentStore.getState().openPath(path, { allow: true });
        }
      })
        .then((fn) => {
          unlistenOpenFiles = fn;
        })
        .catch(() => {});

      void getCurrentWebview()
        .onDragDropEvent((event) => {
          if (event.payload.type === "drop") {
            for (const path of event.payload.paths) {
              if (/\.(md|markdown|mdown|mkd|mmd|txt)$/i.test(path)) {
                void useDocumentStore.getState().openPath(path, { allow: true });
              }
            }
          }
        })
        .then((fn) => {
          unlistenDrop = fn;
        })
        .catch(() => {});

      // Unsaved-changes guard on window close.
      void getCurrentWindow()
        .onCloseRequested(async (event) => {
          const dirty = useDocumentStore
            .getState()
            .openDocuments.filter((d) => d.isDirty);
          if (dirty.length > 0) {
            event.preventDefault();
            const closed = await useDocumentStore.getState().closeAll();
            if (closed) {
              await getCurrentWindow().destroy();
            }
          }
        })
        .then((fn) => {
          unlistenClose = fn;
        })
        .catch(() => {});
    } catch {
      /* not running inside Tauri */
    }

    return () => {
      window.removeEventListener("keydown", onKeydown, { capture: true });
      unlistenDrop?.();
      unlistenClose?.();
      unlistenOpenFiles?.();
    };
  }, []);

  return <AppShell />;
}
