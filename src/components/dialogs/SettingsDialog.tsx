import * as Dialog from "@radix-ui/react-dialog";
import * as Tabs from "@radix-ui/react-tabs";
import { X } from "lucide-react";

import { useAppStore } from "@/state/appStore";
import { useSettingsStore } from "@/state/settingsStore";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label
      className="flex items-center justify-between gap-4 py-1.5 text-xs"
      style={{ color: "var(--text-secondary)" }}
    >
      <span>{label}</span>
      <span className="w-52 shrink-0">{children}</span>
    </label>
  );
}

const tabClass = "btn data-[state=active]:text-[var(--accent)]";

export default function SettingsDialog() {
  const open = useAppStore((s) => s.activeDialog === "settings");
  const closeDialog = useAppStore((s) => s.closeDialog);
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && closeDialog()}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content" style={{ width: 640 }}>
          <div
            className="flex items-center justify-between border-b px-4 py-3"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            <Dialog.Title className="text-sm font-semibold">
              Preferences
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="icon-btn" aria-label="Close settings">
                <X size={15} />
              </button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">
            Application settings
          </Dialog.Description>

          <Tabs.Root defaultValue="appearance" className="flex min-h-0 flex-1 flex-col">
            <Tabs.List
              className="flex gap-1 border-b px-3 py-1.5"
              style={{ borderColor: "var(--border-subtle)" }}
            >
              <Tabs.Trigger className={tabClass} value="appearance">
                Appearance
              </Tabs.Trigger>
              <Tabs.Trigger className={tabClass} value="editor">
                Editor
              </Tabs.Trigger>
              <Tabs.Trigger className={tabClass} value="preview">
                Preview
              </Tabs.Trigger>
              <Tabs.Trigger className={tabClass} value="mermaid">
                Mermaid
              </Tabs.Trigger>
              <Tabs.Trigger className={tabClass} value="files">
                Files
              </Tabs.Trigger>
            </Tabs.List>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              <Tabs.Content value="appearance">
                <Field label="Theme">
                  <select
                    className="input"
                    value={settings.theme}
                    onChange={(e) =>
                      update({ theme: e.target.value as typeof settings.theme })
                    }
                  >
                    <option value="system">System</option>
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </select>
                </Field>
                <Field label="Layout density">
                  <select
                    className="input"
                    value={settings.density}
                    onChange={(e) =>
                      update({
                        density: e.target.value as typeof settings.density,
                      })
                    }
                  >
                    <option value="comfortable">Comfortable</option>
                    <option value="compact">Compact</option>
                    <option value="dense">Dense</option>
                  </select>
                </Field>
              </Tabs.Content>

              <Tabs.Content value="editor">
                <Field label="Font family">
                  <input
                    className="input"
                    value={settings.editor.fontFamily}
                    onChange={(e) =>
                      update({ editor: { fontFamily: e.target.value } })
                    }
                  />
                </Field>
                <Field label="Font size">
                  <input
                    className="input"
                    type="number"
                    min={9}
                    max={32}
                    value={settings.editor.fontSize}
                    onChange={(e) =>
                      update({ editor: { fontSize: Number(e.target.value) } })
                    }
                  />
                </Field>
                <Field label="Line height">
                  <input
                    className="input"
                    type="number"
                    step={0.1}
                    min={1}
                    max={3}
                    value={settings.editor.lineHeight}
                    onChange={(e) =>
                      update({ editor: { lineHeight: Number(e.target.value) } })
                    }
                  />
                </Field>
                <Field label="Tab size">
                  <input
                    className="input"
                    type="number"
                    min={1}
                    max={8}
                    value={settings.editor.tabSize}
                    onChange={(e) =>
                      update({ editor: { tabSize: Number(e.target.value) } })
                    }
                  />
                </Field>
                <Field label="Word wrap">
                  <input
                    type="checkbox"
                    checked={settings.editor.wordWrap}
                    onChange={(e) =>
                      update({ editor: { wordWrap: e.target.checked } })
                    }
                  />
                </Field>
                <Field label="Minimap">
                  <input
                    type="checkbox"
                    checked={settings.editor.minimap}
                    onChange={(e) =>
                      update({ editor: { minimap: e.target.checked } })
                    }
                  />
                </Field>
                <Field label="Autosave">
                  <input
                    type="checkbox"
                    checked={settings.editor.autoSave}
                    onChange={(e) =>
                      update({ editor: { autoSave: e.target.checked } })
                    }
                  />
                </Field>
                <Field label="Autosave delay (ms)">
                  <input
                    className="input"
                    type="number"
                    min={250}
                    step={250}
                    value={settings.editor.autoSaveDelayMs}
                    onChange={(e) =>
                      update({
                        editor: { autoSaveDelayMs: Number(e.target.value) },
                      })
                    }
                  />
                </Field>
              </Tabs.Content>

              <Tabs.Content value="preview">
                <Field label="Preview theme">
                  <select
                    className="input"
                    value={settings.preview.theme}
                    onChange={(e) =>
                      update({ preview: { theme: e.target.value } })
                    }
                  >
                    {[
                      "github",
                      "minimal",
                      "technical",
                      "book",
                      "presentation",
                      "dark-technical",
                    ].map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Sync scroll">
                  <input
                    type="checkbox"
                    checked={settings.preview.syncScroll}
                    onChange={(e) =>
                      update({ preview: { syncScroll: e.target.checked } })
                    }
                  />
                </Field>
              </Tabs.Content>

              <Tabs.Content value="mermaid">
                <Field label="Diagram theme">
                  <select
                    className="input"
                    value={settings.mermaid.theme}
                    onChange={(e) =>
                      update({
                        mermaid: {
                          theme: e.target.value as typeof settings.mermaid.theme,
                        },
                      })
                    }
                  >
                    {["default", "dark", "forest", "neutral"].map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </Field>
                <p className="pt-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
                  Diagrams always render with strict security mode; HTML labels
                  are disabled.
                </p>
              </Tabs.Content>

              <Tabs.Content value="files">
                <Field label="Restore last session">
                  <input
                    type="checkbox"
                    checked={settings.files.restoreLastSession}
                    onChange={(e) =>
                      update({ files: { restoreLastSession: e.target.checked } })
                    }
                  />
                </Field>
                <Field label="Confirm before delete">
                  <input
                    type="checkbox"
                    checked={settings.files.confirmBeforeDelete}
                    onChange={(e) =>
                      update({
                        files: { confirmBeforeDelete: e.target.checked },
                      })
                    }
                  />
                </Field>
                <Field label="Create recovery snapshots">
                  <input
                    type="checkbox"
                    checked={settings.files.createBackups}
                    onChange={(e) =>
                      update({ files: { createBackups: e.target.checked } })
                    }
                  />
                </Field>
              </Tabs.Content>
            </div>
          </Tabs.Root>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
