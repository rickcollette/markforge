// In-app updates via the Tauri updater plugin. The update manifest
// (latest.json) is published on GitHub Pages and points at the GitHub
// release assets; artifacts are minisign-verified against the public key
// in tauri.conf.json before installing.
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

import { useAppStore, toastError } from "@/state/appStore";
import { confirmDialog, messageDialog } from "@/lib/tauri/dialogs";

let inFlight = false;

export async function checkForUpdates(): Promise<void> {
  if (inFlight) return;
  inFlight = true;
  const toast = useAppStore.getState().toast;
  try {
    const update = await check();
    if (!update) {
      toast({ kind: "success", title: "MarkForge is up to date" });
      return;
    }

    const notes = update.body ? `\n\n${update.body}` : "";
    const go = await confirmDialog(
      `MarkForge ${update.version} is available (you have ${update.currentVersion}).${notes}\n\nDownload and install now?`,
      "Update Available",
    );
    if (!go) return;

    toast({
      kind: "info",
      title: `Downloading MarkForge ${update.version}…`,
      detail: "You'll be prompted to restart when it's ready.",
    });
    await update.downloadAndInstall();

    // On Windows the installer exits the app itself; reaching this point
    // means we're on Linux/macOS where a manual relaunch applies the update.
    const restart = await confirmDialog(
      "Update installed. Restart MarkForge now?",
      "Update Ready",
    );
    if (restart) await relaunch();
  } catch (err) {
    const msg = String(err);
    if (/AppImage|deb|package/i.test(msg)) {
      // Installed via .deb (or another non-updatable format): in-app update
      // only works for the AppImage/installer builds.
      await messageDialog(
        "This install can't update itself. Download the latest package from " +
          "https://markforge.rickcollette.org/ and install it over this version.",
        "Manual Update Required",
      );
    } else {
      toastError("Update check failed", err);
    }
  } finally {
    inFlight = false;
  }
}
