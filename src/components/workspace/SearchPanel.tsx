import { useState } from "react";
import { Search, X } from "lucide-react";

import { useWorkspaceStore } from "@/state/workspaceStore";
import { useDocumentStore, editorBridge } from "@/state/documentStore";

export default function SearchPanel() {
  const {
    workspacePath,
    searchResults,
    searching,
    search,
    clearSearch,
  } = useWorkspaceStore();
  const openPath = useDocumentStore((s) => s.openPath);
  const [query, setQuery] = useState("");
  const [glob, setGlob] = useState("");

  if (!workspacePath) {
    return (
      <p className="p-4 text-xs" style={{ color: "var(--text-muted)" }}>
        Open a workspace folder to search across files.
      </p>
    );
  }

  const grouped = new Map<string, typeof searchResults>();
  for (const result of searchResults) {
    const list = grouped.get(result.path) ?? [];
    list.push(result);
    grouped.set(result.path, list);
  }

  const relative = (path: string) =>
    path.startsWith(workspacePath)
      ? path.slice(workspacePath.length).replace(/^[\\/]/, "")
      : path;

  return (
    <div className="flex h-full flex-col gap-1.5 p-2">
      <form
        className="flex flex-col gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          if (query.trim()) void search(query, glob.trim() || undefined);
        }}
      >
        <div className="flex items-center gap-1">
          <input
            className="input"
            placeholder="Search in workspace…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search query"
          />
          <button className="icon-btn shrink-0" type="submit" title="Search">
            <Search size={14} />
          </button>
          {searchResults.length > 0 && (
            <button
              className="icon-btn shrink-0"
              type="button"
              title="Clear results"
              onClick={() => {
                clearSearch();
                setQuery("");
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>
        <input
          className="input"
          placeholder="File filter, e.g. *.md"
          value={glob}
          onChange={(e) => setGlob(e.target.value)}
          aria-label="File filter glob"
        />
      </form>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {searching && (
          <p className="p-2 text-xs" style={{ color: "var(--text-muted)" }}>
            Searching…
          </p>
        )}
        {!searching && searchResults.length === 0 && query && (
          <p className="p-2 text-xs" style={{ color: "var(--text-muted)" }}>
            No results.
          </p>
        )}
        {[...grouped.entries()].map(([path, results]) => (
          <div key={path} className="mb-1.5">
            <div
              className="truncate px-1 py-1 text-[11px] font-semibold"
              style={{ color: "var(--text-secondary)" }}
              title={path}
            >
              {relative(path)}{" "}
              <span style={{ color: "var(--text-muted)" }}>
                ({results.length})
              </span>
            </div>
            {results.map((r, i) => (
              <button
                key={i}
                className="tree-row w-full pl-3 text-left"
                onClick={async () => {
                  await openPath(path);
                  setTimeout(
                    () => editorBridge()?.goToLine(r.line, r.column),
                    150,
                  );
                }}
                title={`Line ${r.line}`}
              >
                <span
                  className="shrink-0 text-[10.5px]"
                  style={{ color: "var(--text-muted)" }}
                >
                  {r.line}:
                </span>
                <span className="truncate text-xs">{r.preview}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
