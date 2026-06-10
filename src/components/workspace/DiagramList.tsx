import { useMemo } from "react";
import { Workflow, ExternalLink } from "lucide-react";

import { extractMermaidBlocks } from "@/lib/mermaid/mermaidParser";
import { useActiveDocument, editorBridge } from "@/state/documentStore";
import { useAppStore } from "@/state/appStore";

/** Mermaid diagrams detected in the current file (sidebar panel). */
export default function DiagramList() {
  const doc = useActiveDocument();
  const setStudioContext = useAppStore((s) => s.setStudioContext);
  const setStudioSource = useAppStore((s) => s.setStudioSource);
  const setEditorMode = useAppStore((s) => s.setEditorMode);

  const blocks = useMemo(
    () => (doc ? extractMermaidBlocks(doc.content) : []),
    [doc?.content, doc],
  );

  if (!doc) {
    return (
      <p className="p-4 text-xs" style={{ color: "var(--text-muted)" }}>
        Open a Markdown file to list its diagrams.
      </p>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto p-2">
      <h3
        className="px-1 pb-1 text-[11px] font-bold uppercase tracking-wide"
        style={{ color: "var(--text-muted)" }}
      >
        Diagrams in {doc.title} ({blocks.length})
      </h3>
      {blocks.length === 0 && (
        <p className="px-1 text-xs" style={{ color: "var(--text-muted)" }}>
          No mermaid blocks in this document.
        </p>
      )}
      {blocks.map((block) => (
        <div key={block.index} className="tree-row group w-full">
          <Workflow size={13} className="shrink-0" color="var(--accent)" />
          <button
            className="min-w-0 flex-1 truncate text-left"
            title={`Line ${block.startLine}`}
            onClick={() => editorBridge()?.goToLine(block.startLine)}
          >
            {block.type} · line {block.startLine}
          </button>
          <button
            className="icon-btn"
            title="Open in Mermaid Studio"
            onClick={() => {
              setStudioContext({
                documentId: doc.id,
                blockIndex: block.index,
                source: block.source,
              });
              setStudioSource(block.source);
              setEditorMode("mermaid-studio");
            }}
          >
            <ExternalLink size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}
