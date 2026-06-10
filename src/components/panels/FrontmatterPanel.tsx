import { useEffect, useState } from "react";
import yaml from "js-yaml";

import {
  applyRawFrontmatter,
  extractFrontmatter,
} from "@/lib/markdown/frontmatter";
import { useActiveDocument, useDocumentStore } from "@/state/documentStore";
import { useAppStore } from "@/state/appStore";

const KNOWN_FIELDS = ["title", "description", "draft"] as const;

export default function FrontmatterPanel() {
  const doc = useActiveDocument();
  const setContent = useDocumentStore((s) => s.setContent);
  const toast = useAppStore((s) => s.toast);
  const [rawMode, setRawMode] = useState(false);
  const [rawText, setRawText] = useState("");

  const fm = doc ? extractFrontmatter(doc.content) : null;

  useEffect(() => {
    setRawText(fm?.raw ?? "");
    // Only reset when switching documents, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.id]);

  if (!doc) {
    return (
      <p className="p-4 text-xs" style={{ color: "var(--text-muted)" }}>
        Open a document to edit its frontmatter.
      </p>
    );
  }

  const data = fm?.data ?? {};
  const hasFrontmatter = fm?.raw !== null && fm?.raw !== undefined;

  const updateField = (key: string, value: unknown) => {
    // Preserve unknown keys: mutate a copy of the parsed object.
    const next: Record<string, unknown> = { ...data, [key]: value };
    if (value === "" || value === undefined) delete next[key];
    try {
      const rawYaml = yaml.dump(next, { lineWidth: 100 }).trimEnd();
      setContent(doc.id, applyRawFrontmatter(doc.content, rawYaml));
    } catch {
      toast({ kind: "error", title: "Could not update frontmatter" });
    }
  };

  const applyRaw = () => {
    try {
      if (rawText.trim()) {
        const parsed = yaml.load(rawText);
        if (parsed !== null && typeof parsed !== "object") {
          toast({ kind: "warning", title: "Frontmatter must be a YAML mapping" });
          return;
        }
      }
      setContent(doc.id, applyRawFrontmatter(doc.content, rawText));
      toast({ kind: "success", title: "Frontmatter updated" });
    } catch (err) {
      toast({
        kind: "error",
        title: "Invalid YAML",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const tags = Array.isArray(data.tags) ? (data.tags as unknown[]) : [];

  return (
    <div className="flex h-full flex-col gap-2 overflow-y-auto p-3">
      <div className="flex items-center justify-between">
        <h3
          className="text-[11px] font-bold uppercase tracking-wide"
          style={{ color: "var(--text-muted)" }}
        >
          Frontmatter
        </h3>
        <button className="btn" onClick={() => setRawMode((v) => !v)}>
          {rawMode ? "Form view" : "Raw YAML"}
        </button>
      </div>

      {!hasFrontmatter && !rawMode && (
        <div className="flex flex-col gap-2">
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            This document has no frontmatter block.
          </p>
          <button
            className="btn btn-primary self-start"
            onClick={() =>
              setContent(
                doc.id,
                applyRawFrontmatter(
                  doc.content,
                  `title: ${doc.title.replace(/\.md$/i, "")}\ndraft: true`,
                ),
              )
            }
          >
            Add frontmatter
          </button>
        </div>
      )}

      {rawMode ? (
        <>
          <textarea
            className="input min-h-40 flex-1"
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            spellCheck={false}
            aria-label="Raw YAML frontmatter"
          />
          <button className="btn btn-primary self-end" onClick={applyRaw}>
            Apply
          </button>
        </>
      ) : (
        hasFrontmatter && (
          <div className="flex flex-col gap-2.5">
            {KNOWN_FIELDS.map((field) =>
              field === "draft" ? (
                <label key={field} className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={Boolean(data.draft)}
                    onChange={(e) => updateField("draft", e.target.checked)}
                  />
                  Draft
                </label>
              ) : (
                <label
                  key={field}
                  className="flex flex-col gap-1 text-xs capitalize"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {field}
                  <input
                    className="input"
                    value={String(data[field] ?? "")}
                    onChange={(e) => updateField(field, e.target.value)}
                  />
                </label>
              ),
            )}
            <label
              className="flex flex-col gap-1 text-xs"
              style={{ color: "var(--text-secondary)" }}
            >
              Tags (comma separated)
              <input
                className="input"
                value={tags.map(String).join(", ")}
                onChange={(e) =>
                  updateField(
                    "tags",
                    e.target.value
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean),
                  )
                }
              />
            </label>
            {Object.keys(data).filter(
              (k) => !["title", "description", "draft", "tags"].includes(k),
            ).length > 0 && (
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                Additional keys preserved:{" "}
                {Object.keys(data)
                  .filter(
                    (k) =>
                      !["title", "description", "draft", "tags"].includes(k),
                  )
                  .join(", ")}
              </p>
            )}
          </div>
        )
      )}
    </div>
  );
}
