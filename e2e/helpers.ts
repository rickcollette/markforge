import type { Page } from "@playwright/test";

/** Minimal Tauri IPC mock so the frontend boots in a plain browser.
 * Commands that have no meaningful browser equivalent reject, which the
 * app treats as "feature unavailable" (every call site handles errors). */
export async function installTauriMock(page: Page): Promise<void> {
  await page.addInitScript(() => {
    let callbackId = 1;
    const internals = {
      metadata: {
        currentWebview: { label: "main" },
        currentWindow: { label: "main" },
      },
      plugins: {},
      transformCallback: (_cb: unknown) => callbackId++,
      invoke: (cmd: string, _args?: unknown) => {
        switch (cmd) {
          case "plugin:event|listen":
          case "plugin:event|unlisten":
            return Promise.resolve(callbackId++);
          case "load_settings":
            return Promise.reject("not available in browser");
          case "load_app_data":
            return Promise.resolve(null);
          case "list_recovery_snapshots":
          case "take_startup_files":
            return Promise.resolve([]);
          case "app_version":
            return Promise.resolve("0.1.0-e2e");
          case "save_settings":
          case "save_app_data":
          case "save_recovery_snapshot":
          case "delete_recovery_snapshot":
            return Promise.resolve(null);
          default:
            return Promise.reject(
              `command ${cmd} is not available in the browser test harness`,
            );
        }
      },
    };
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      value: internals,
    });
  });
}

/** Type into the active Monaco editor. */
export async function typeInEditor(page: Page, text: string): Promise<void> {
  const editor = page.locator(".monaco-editor").first();
  await editor.click();
  await page.keyboard.type(text, { delay: 5 });
}
