import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { invoke } from "@tauri-apps/api/core";
import { X } from "lucide-react";

import { openUrl } from "@tauri-apps/plugin-opener";

import { useAppStore } from "@/state/appStore";
import { DEFAULT_KEYMAP, formatShortcut } from "@/lib/commands/keymap";
import { getCommand } from "@/lib/commands/registry";

export function AboutDialog() {
  const open = useAppStore((s) => s.activeDialog === "about");
  const closeDialog = useAppStore((s) => s.closeDialog);
  const [version, setVersion] = useState("1.0.0");

  useEffect(() => {
    if (open) {
      invoke<string>("app_version")
        .then(setVersion)
        .catch(() => {});
    }
  }, [open]);

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && closeDialog()}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className="dialog-content"
          style={{ width: 420 }}
          aria-describedby={undefined}
        >
          <div className="flex flex-col items-center gap-2 p-6 text-center">
            <img
              src="/Logo_Icon_Large.png"
              alt=""
              className="h-16 w-16"
              draggable={false}
            />
            <img
              src="/Logo_Lettering_Large.png"
              alt="MarkForge"
              className="brand-dark-adapt h-6"
              draggable={false}
            />
            <Dialog.Title className="text-sm font-semibold">
              Markdown Editor with Mermaid Studio
            </Dialog.Title>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Version {version} · Tauri 2 + Rust + React
            </p>
            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              A professional-grade, offline-first editor for Markdown documents
              and Mermaid diagrams. Diagrams render in strict security mode;
              preview HTML is sanitized.
            </p>
            <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
              © 2026 Rick Collette (megalith@root.sh)
            </p>
            <p className="text-xs">
              <button
                className="cursor-pointer underline"
                style={{ color: "var(--accent)" }}
                onClick={() => void openUrl("https://github.com/rickcollette")}
              >
                GitHub: @rickcollette
              </button>
              <span style={{ color: "var(--text-muted)" }}> · </span>
              <button
                className="cursor-pointer underline"
                style={{ color: "var(--accent)" }}
                onClick={() =>
                  void openUrl("https://github.com/rickcollette/markforge")
                }
              >
                rickcollette/markforge
              </button>
            </p>
            <Dialog.Close asChild>
              <button className="btn btn-primary mt-2">Close</button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function ShortcutsDialog() {
  const open = useAppStore((s) => s.activeDialog === "shortcuts");
  const closeDialog = useAppStore((s) => s.closeDialog);

  const entries = Object.entries(DEFAULT_KEYMAP)
    .map(([combo, commandId]) => ({
      shortcut: formatShortcut(combo),
      command: getCommand(commandId),
    }))
    .filter((e) => e.command);

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && closeDialog()}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content" aria-describedby={undefined}>
          <div
            className="flex items-center justify-between border-b px-4 py-3"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            <Dialog.Title className="text-sm font-semibold">
              Keyboard Shortcuts
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="icon-btn" aria-label="Close shortcuts">
                <X size={15} />
              </button>
            </Dialog.Close>
          </div>
          <div className="max-h-96 overflow-y-auto p-3">
            {entries.map(({ shortcut, command }) => (
              <div
                key={command!.id}
                className="flex items-center justify-between border-b py-1.5 text-xs"
                style={{ borderColor: "var(--border-subtle)" }}
              >
                <span>
                  <span
                    className="mr-2 rounded px-1 py-0.5 text-[10px] uppercase"
                    style={{ background: "var(--accent-bg)", color: "var(--accent)" }}
                  >
                    {command!.category}
                  </span>
                  {command!.title}
                </span>
                <kbd
                  className="rounded border px-1.5 py-0.5 text-[11px]"
                  style={{
                    borderColor: "var(--border-subtle)",
                    background: "var(--bg-app)",
                  }}
                >
                  {shortcut}
                </kbd>
              </div>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
