import { useEffect, useMemo, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Search } from "lucide-react";

import {
  isCommandEnabled,
  runCommand,
  searchCommands,
} from "@/lib/commands/registry";
import { useAppStore } from "@/state/appStore";

export default function CommandPalette() {
  const open = useAppStore((s) => s.activeDialog === "command-palette");
  const closeDialog = useAppStore((s) => s.closeDialog);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => searchCommands(query).slice(0, 60), [query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(0);
    }
  }, [open]);

  useEffect(() => setSelected(0), [query]);

  useEffect(() => {
    const el = listRef.current?.children[selected] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  const execute = async (index: number) => {
    const command = results[index];
    if (!command || !isCommandEnabled(command.id)) return;
    closeDialog();
    await runCommand(command.id);
  };

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && closeDialog()}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className="dialog-content"
          style={{ top: "10%" }}
          aria-describedby={undefined}
        >
          <Dialog.Title className="sr-only">Command Palette</Dialog.Title>
          <div
            className="flex items-center gap-2 border-b px-3"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            <Search size={14} style={{ color: "var(--text-muted)" }} />
            <input
              autoFocus
              className="h-10 w-full bg-transparent text-sm outline-none"
              style={{ color: "var(--text-primary)" }}
              placeholder="Type a command…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setSelected((s) => Math.min(results.length - 1, s + 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setSelected((s) => Math.max(0, s - 1));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  void execute(selected);
                }
              }}
            />
          </div>
          <div ref={listRef} className="max-h-96 overflow-y-auto p-1.5">
            {results.length === 0 && (
              <p className="p-3 text-xs" style={{ color: "var(--text-muted)" }}>
                No matching commands.
              </p>
            )}
            {results.map((command, i) => {
              const enabled = isCommandEnabled(command.id);
              return (
                <button
                  key={command.id}
                  className="menu-item w-full text-left"
                  data-highlighted={i === selected ? "" : undefined}
                  data-disabled={!enabled || undefined}
                  disabled={!enabled}
                  onMouseEnter={() => setSelected(i)}
                  onClick={() => void execute(i)}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className="shrink-0 rounded px-1 py-0.5 text-[10px] uppercase tracking-wide"
                      style={{
                        background: "var(--accent-bg)",
                        color: "var(--accent)",
                      }}
                    >
                      {command.category}
                    </span>
                    <span className="truncate">{command.title}</span>
                  </span>
                  {command.shortcut && (
                    <span className="menu-shortcut">{command.shortcut}</span>
                  )}
                </button>
              );
            })}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
