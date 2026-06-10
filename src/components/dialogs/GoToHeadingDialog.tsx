import { useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Hash } from "lucide-react";

import { useAppStore } from "@/state/appStore";
import { editorBridge, useActiveDocument } from "@/state/documentStore";
import { extractHeadings } from "@/lib/markdown/markdownParser";

export default function GoToHeadingDialog() {
  const open = useAppStore((s) => s.activeDialog === "go-to-heading");
  const closeDialog = useAppStore((s) => s.closeDialog);
  const doc = useActiveDocument();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);

  const headings = useMemo(() => {
    if (!doc) return [];
    const all = extractHeadings(doc.content);
    const q = query.trim().toLowerCase();
    return q ? all.filter((h) => h.text.toLowerCase().includes(q)) : all;
  }, [doc, query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(0);
    }
  }, [open]);

  const go = (index: number) => {
    const heading = headings[index];
    if (!heading) return;
    closeDialog();
    editorBridge()?.goToLine(heading.line);
  };

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && closeDialog()}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className="dialog-content"
          style={{ top: "10%", width: 460 }}
          aria-describedby={undefined}
        >
          <Dialog.Title className="sr-only">Go to Heading</Dialog.Title>
          <div
            className="flex items-center gap-2 border-b px-3"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            <Hash size={14} style={{ color: "var(--text-muted)" }} />
            <input
              autoFocus
              className="h-10 w-full bg-transparent text-sm outline-none"
              style={{ color: "var(--text-primary)" }}
              placeholder="Go to heading…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelected(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setSelected((s) => Math.min(headings.length - 1, s + 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setSelected((s) => Math.max(0, s - 1));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  go(selected);
                }
              }}
            />
          </div>
          <div className="max-h-80 overflow-y-auto p-1.5">
            {headings.map((h, i) => (
              <button
                key={`${h.line}-${i}`}
                className="menu-item w-full text-left"
                data-highlighted={i === selected ? "" : undefined}
                style={{ paddingLeft: (h.level - 1) * 12 + 10 }}
                onMouseEnter={() => setSelected(i)}
                onClick={() => go(i)}
              >
                <span className="truncate">{h.text}</span>
                <span className="menu-shortcut">L{h.line}</span>
              </button>
            ))}
            {headings.length === 0 && (
              <p className="p-3 text-xs" style={{ color: "var(--text-muted)" }}>
                No headings found.
              </p>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
