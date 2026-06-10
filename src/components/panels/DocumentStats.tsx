import { useMemo } from "react";

import { documentWordStats, useActiveDocument } from "@/state/documentStore";
import { extractMermaidBlocks } from "@/lib/mermaid/mermaidParser";
import { extractHeadings } from "@/lib/markdown/markdownParser";
import { extractLinks } from "@/lib/markdown/markdownLinter";

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      className="flex items-center justify-between border-b py-1.5 text-xs"
      style={{ borderColor: "var(--border-subtle)" }}
    >
      <span style={{ color: "var(--text-secondary)" }}>{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

export default function DocumentStats() {
  const doc = useActiveDocument();

  const stats = useMemo(() => {
    if (!doc) return null;
    const { words, chars, readingMinutes } = documentWordStats(doc.content);
    const lines = doc.content.split("\n").length;
    const headings = extractHeadings(doc.content).length;
    const diagrams = extractMermaidBlocks(doc.content).length;
    const links = extractLinks(doc.content);
    const paragraphs = doc.content
      .split(/\n{2,}/)
      .filter((p) => p.trim() !== "").length;
    return {
      words,
      chars,
      readingMinutes,
      lines,
      headings,
      diagrams,
      paragraphs,
      links: links.length,
      images: links.filter((l) => l.kind === "image").length,
    };
  }, [doc?.content, doc]);

  if (!doc || !stats) {
    return (
      <p className="p-4 text-xs" style={{ color: "var(--text-muted)" }}>
        Open a document to see statistics.
      </p>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-3">
      <h3
        className="pb-2 text-[11px] font-bold uppercase tracking-wide"
        style={{ color: "var(--text-muted)" }}
      >
        Document Stats
      </h3>
      <Row label="Words" value={stats.words.toLocaleString()} />
      <Row label="Characters" value={stats.chars.toLocaleString()} />
      <Row label="Lines" value={stats.lines.toLocaleString()} />
      <Row label="Paragraphs" value={stats.paragraphs.toLocaleString()} />
      <Row label="Headings" value={stats.headings} />
      <Row label="Links" value={stats.links} />
      <Row label="Images" value={stats.images} />
      <Row label="Mermaid diagrams" value={stats.diagrams} />
      <Row label="Reading time" value={`${stats.readingMinutes} min`} />
      <Row
        label="Last saved"
        value={
          doc.lastSavedAt ? new Date(doc.lastSavedAt).toLocaleString() : "Never"
        }
      />
    </div>
  );
}
