import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, Trash2, X } from "lucide-react";

import { useAppStore } from "@/state/appStore";
import { editorBridge } from "@/state/documentStore";
import {
  BUILTIN_SNIPPETS,
  loadUserSnippets,
  saveUserSnippets,
} from "@/lib/snippets";
import type { Snippet } from "@/lib/types";

export default function SnippetsDialog() {
  const open = useAppStore((s) => s.activeDialog === "snippets");
  const closeDialog = useAppStore((s) => s.closeDialog);
  const toast = useAppStore((s) => s.toast);
  const [userSnippets, setUserSnippets] = useState<Snippet[]>([]);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Snippet | null>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setEditing(null);
      void loadUserSnippets().then(setUserSnippets);
    }
  }, [open]);

  const all = [...userSnippets, ...BUILTIN_SNIPPETS];
  const filtered = query.trim()
    ? all.filter((s) =>
        `${s.name} ${s.description}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
      )
    : all;

  const insert = (snippet: Snippet) => {
    const bridge = editorBridge();
    if (!bridge) {
      toast({ kind: "warning", title: "Open a document first" });
      return;
    }
    bridge.insertText(snippet.body);
    closeDialog();
    bridge.focus();
  };

  const persist = async (snippets: Snippet[]) => {
    setUserSnippets(snippets);
    await saveUserSnippets(snippets);
  };

  const saveEditing = async () => {
    if (!editing) return;
    const without = userSnippets.filter((s) => s.id !== editing.id);
    await persist([{ ...editing, builtIn: false }, ...without]);
    setEditing(null);
    toast({ kind: "success", title: "Snippet saved" });
  };

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && closeDialog()}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content" style={{ width: 620 }}>
          <div
            className="flex items-center justify-between border-b px-4 py-3"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            <Dialog.Title className="text-sm font-semibold">
              Snippets
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="icon-btn" aria-label="Close snippets">
                <X size={15} />
              </button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">
            Insert and manage snippets
          </Dialog.Description>

          {editing ? (
            <div className="flex flex-col gap-2.5 p-4">
              <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                Name
                <input
                  className="input"
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                Description
                <input
                  className="input"
                  value={editing.description}
                  onChange={(e) =>
                    setEditing({ ...editing, description: e.target.value })
                  }
                />
              </label>
              <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                Body
                <textarea
                  className="input min-h-36"
                  value={editing.body}
                  onChange={(e) => setEditing({ ...editing, body: e.target.value })}
                  spellCheck={false}
                />
              </label>
              <div className="flex justify-end gap-2">
                <button className="btn" onClick={() => setEditing(null)}>
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  disabled={!editing.name.trim() || !editing.body.trim()}
                  onClick={() => void saveEditing()}
                >
                  Save Snippet
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 px-4 pt-3">
                <input
                  autoFocus
                  className="input"
                  placeholder="Search snippets…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <button
                  className="btn shrink-0"
                  onClick={() =>
                    setEditing({
                      id: `user-${Date.now()}`,
                      name: "",
                      description: "",
                      body: "",
                    })
                  }
                >
                  <Plus size={13} /> New
                </button>
              </div>
              <div className="max-h-96 overflow-y-auto p-3">
                {filtered.map((snippet) => (
                  <div
                    key={snippet.id}
                    className="mb-1.5 rounded-lg border p-2.5"
                    style={{ borderColor: "var(--border-subtle)" }}
                  >
                    <div className="flex items-center gap-2">
                      <button
                        className="min-w-0 flex-1 text-left"
                        onClick={() => insert(snippet)}
                        title="Insert into document"
                      >
                        <span className="block truncate text-xs font-semibold">
                          {snippet.name}
                          {snippet.builtIn && (
                            <span className="ml-1.5 text-[10px] font-normal" style={{ color: "var(--text-muted)" }}>
                              built-in
                            </span>
                          )}
                        </span>
                        <span className="block truncate text-[11px]" style={{ color: "var(--text-muted)" }}>
                          {snippet.description}
                        </span>
                      </button>
                      <button className="btn shrink-0" onClick={() => insert(snippet)}>
                        Insert
                      </button>
                      {!snippet.builtIn && (
                        <>
                          <button
                            className="btn shrink-0"
                            onClick={() => setEditing(snippet)}
                          >
                            Edit
                          </button>
                          <button
                            className="icon-btn shrink-0"
                            aria-label="Delete snippet"
                            onClick={() =>
                              void persist(
                                userSnippets.filter((s) => s.id !== snippet.id),
                              )
                            }
                          >
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
                      {snippet.builtIn && (
                        <button
                          className="btn shrink-0"
                          title="Copy as editable user snippet"
                          onClick={() =>
                            setEditing({
                              ...snippet,
                              id: `user-${Date.now()}`,
                              builtIn: false,
                            })
                          }
                        >
                          Duplicate
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {filtered.length === 0 && (
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    No snippets match.
                  </p>
                )}
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
