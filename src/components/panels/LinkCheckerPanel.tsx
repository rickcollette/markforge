import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ExternalLink, HelpCircle, XCircle } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";

import { extractLinks, type DocumentLink } from "@/lib/markdown/markdownLinter";
import { extractHeadings } from "@/lib/markdown/markdownParser";
import { slugify } from "@/lib/markdown/slugify";
import { fileExists } from "@/lib/tauri/commands";
import { editorBridge, useActiveDocument } from "@/state/documentStore";

type Status = "ok" | "broken" | "unknown";

function dirOf(path: string): string {
  const idx = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return idx >= 0 ? path.slice(0, idx) : path;
}

function resolveRelative(base: string, rel: string): string {
  const sep = base.includes("\\") ? "\\" : "/";
  const parts = base.split(/[\\/]/);
  for (const segment of rel.replace(/\\/g, "/").split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") parts.pop();
    else parts.push(segment);
  }
  return parts.join(sep);
}

export default function LinkCheckerPanel() {
  const doc = useActiveDocument();
  const [statuses, setStatuses] = useState<Map<number, Status>>(new Map());

  const links = useMemo(
    () => (doc ? extractLinks(doc.content) : []),
    [doc?.content, doc],
  );

  useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    const run = async () => {
      const headingSlugs = new Set(
        extractHeadings(doc.content).map((h) => h.slug),
      );
      const next = new Map<number, Status>();
      for (let i = 0; i < links.length; i++) {
        const link = links[i];
        if (link.kind === "heading") {
          const target = decodeURIComponent(link.target.slice(1));
          next.set(
            i,
            headingSlugs.has(target) || headingSlugs.has(slugify(target))
              ? "ok"
              : "broken",
          );
        } else if (link.kind === "file" || link.kind === "image") {
          if (!doc.path) {
            next.set(i, "unknown");
          } else {
            const target = link.target.split("#")[0];
            try {
              const exists = await fileExists(
                resolveRelative(dirOf(doc.path), decodeURIComponent(target)),
              );
              next.set(i, exists ? "ok" : "broken");
            } catch {
              next.set(i, "unknown");
            }
          }
        } else {
          // External / mailto: manual check only (privacy, SPEC.md 25).
          next.set(i, "unknown");
        }
      }
      if (!cancelled) setStatuses(next);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [links, doc?.path, doc?.content, doc]);

  if (!doc) {
    return (
      <p className="p-4 text-xs" style={{ color: "var(--text-muted)" }}>
        Open a document to check its links.
      </p>
    );
  }

  const icon = (status: Status, link: DocumentLink) => {
    if (status === "ok") return <CheckCircle2 size={13} color="var(--success)" />;
    if (status === "broken") return <XCircle size={13} color="var(--danger)" />;
    if (link.kind === "external" || link.kind === "mailto")
      return <HelpCircle size={13} color="var(--text-muted)" />;
    return <HelpCircle size={13} color="var(--text-muted)" />;
  };

  return (
    <div className="h-full overflow-y-auto p-2">
      <h3
        className="px-1 pb-1 text-[11px] font-bold uppercase tracking-wide"
        style={{ color: "var(--text-muted)" }}
      >
        Links ({links.length})
      </h3>
      <p className="px-1 pb-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
        External links are checked manually to avoid unexpected network
        access — use the open button to verify them.
      </p>
      {links.length === 0 && (
        <p className="px-1 text-xs" style={{ color: "var(--text-muted)" }}>
          No links in this document.
        </p>
      )}
      {links.map((link, i) => (
        <div
          key={i}
          className="tree-row w-full"
          style={{ height: "auto", padding: "4px 6px" }}
        >
          <span className="shrink-0">{icon(statuses.get(i) ?? "unknown", link)}</span>
          <button
            className="min-w-0 flex-1 text-left"
            onClick={() => editorBridge()?.goToLine(link.line)}
            title={`Line ${link.line}`}
          >
            <span className="block truncate text-xs">
              {link.text || link.target}
            </span>
            <span
              className="block truncate text-[10.5px]"
              style={{ color: "var(--text-muted)" }}
            >
              {link.kind} · {link.target}
            </span>
          </button>
          {(link.kind === "external" || link.kind === "mailto") && (
            <button
              className="icon-btn shrink-0"
              title="Open in browser to verify"
              onClick={() => void openUrl(link.target)}
            >
              <ExternalLink size={12} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
