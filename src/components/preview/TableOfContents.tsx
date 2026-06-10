import { useMemo } from "react";

import { extractHeadings } from "@/lib/markdown/markdownParser";
import { useActiveDocument, editorBridge } from "@/state/documentStore";

export default function TableOfContents() {
  const doc = useActiveDocument();
  const headings = useMemo(
    () => (doc ? extractHeadings(doc.content) : []),
    [doc?.content, doc],
  );
  if (!doc) {
    return (
      <p className="p-4 text-xs" style={{ color: "var(--text-muted)" }}>
        Open a document to see its outline.
      </p>
    );
  }
  if (headings.length === 0) {
    return (
      <p className="p-4 text-xs" style={{ color: "var(--text-muted)" }}>
        No headings in this document.
      </p>
    );
  }

  return (
    <nav className="h-full overflow-y-auto p-2" aria-label="Document outline">
      {headings.map((h, i) => (
        <button
          key={i}
          className="tree-row w-full text-left"
          style={{ paddingLeft: (h.level - 1) * 12 + 6 }}
          title={`Line ${h.line}`}
          onClick={() => editorBridge()?.goToLine(h.line)}
        >
          <span
            className="shrink-0 text-[10px] font-bold"
            style={{ color: "var(--text-muted)" }}
          >
            H{h.level}
          </span>
          <span className="truncate">{h.text}</span>
        </button>
      ))}
    </nav>
  );
}
