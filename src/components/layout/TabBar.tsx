import { X, Circle } from "lucide-react";

import { useDocumentStore } from "@/state/documentStore";

export default function TabBar() {
  const openDocuments = useDocumentStore((s) => s.openDocuments);
  const activeId = useDocumentStore((s) => s.activeDocumentId);
  const activate = useDocumentStore((s) => s.activate);
  const close = useDocumentStore((s) => s.close);

  if (openDocuments.length === 0) return null;

  return (
    <div
      className="flex h-9 shrink-0 items-stretch overflow-x-auto border-b"
      style={{
        background: "var(--bg-panel)",
        borderColor: "var(--border-subtle)",
      }}
      role="tablist"
      aria-label="Open files"
    >
      {openDocuments.map((doc) => (
        <div
          key={doc.id}
          className="tab"
          data-active={doc.id === activeId}
          role="tab"
          aria-selected={doc.id === activeId}
          title={doc.path ?? doc.title}
          onClick={() => activate(doc.id)}
          onAuxClick={(e) => {
            if (e.button === 1) void close(doc.id);
          }}
        >
          {doc.isDirty && (
            <Circle
              size={8}
              fill="var(--accent)"
              color="var(--accent)"
              aria-label="Unsaved changes"
            />
          )}
          <span className="truncate">{doc.title}</span>
          <button
            className="tab-close"
            aria-label={`Close ${doc.title}`}
            onClick={(e) => {
              e.stopPropagation();
              void close(doc.id);
            }}
          >
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}
