import { AlertTriangle, CheckCircle2, GitBranch, XCircle } from "lucide-react";

import { useAppStore } from "@/state/appStore";
import {
  documentWordStats,
  useActiveDocument,
} from "@/state/documentStore";
import { useWorkspaceStore } from "@/state/workspaceStore";

const MODE_LABELS: Record<string, string> = {
  editor: "Editor",
  split: "Split",
  preview: "Preview",
  "mermaid-studio": "Mermaid Studio",
};

export default function StatusBar() {
  const doc = useActiveDocument();
  const mode = useAppStore((s) => s.editorMode);
  const findings = useAppStore((s) => s.lintFindings);
  const setRightPanelTab = useAppStore((s) => s.setRightPanelTab);
  const git = useWorkspaceStore((s) => s.git);

  const stats = doc ? documentWordStats(doc.content) : null;
  const mermaidErrors = findings.filter((f) => f.source === "mermaid").length;
  const lintWarnings = findings.filter((f) => f.source !== "mermaid").length;

  return (
    <div
      className="flex h-6 shrink-0 items-center gap-3 border-t px-3 text-[11.5px]"
      style={{
        background: "var(--bg-panel)",
        borderColor: "var(--border-subtle)",
        color: "var(--text-muted)",
      }}
      role="status"
    >
      <span className="max-w-[34%] truncate" title={doc?.path ?? undefined}>
        {doc ? (doc.path ?? `${doc.title} (unsaved)`) : "No file open"}
      </span>
      {git?.isRepo && git.branch && (
        <span className="flex items-center gap-1">
          <GitBranch size={11} />
          {git.branch}
        </span>
      )}
      {doc && (
        <span style={{ color: doc.isDirty ? "var(--warning)" : "var(--success)" }}>
          {doc.isDirty ? "● Unsaved" : "Saved"}
        </span>
      )}

      <span className="flex-1" />

      {doc && (
        <button
          className="flex items-center gap-1 hover:underline"
          onClick={() => setRightPanelTab("problems")}
          title="Markdown lint findings"
        >
          {lintWarnings > 0 ? (
            <>
              <AlertTriangle size={11} color="var(--warning)" />
              {lintWarnings}
            </>
          ) : (
            <>
              <CheckCircle2 size={11} color="var(--success)" />
              Lint OK
            </>
          )}
        </button>
      )}
      {doc && (
        <span
          className="flex items-center gap-1"
          title="Mermaid diagram validation"
        >
          {mermaidErrors > 0 ? (
            <>
              <XCircle size={11} color="var(--danger)" />
              {mermaidErrors} diagram error{mermaidErrors > 1 ? "s" : ""}
            </>
          ) : (
            <>
              <CheckCircle2 size={11} color="var(--success)" />
              Mermaid OK
            </>
          )}
        </span>
      )}
      {stats && (
        <span>
          {stats.words.toLocaleString()} words · {stats.chars.toLocaleString()} chars
        </span>
      )}
      {doc && (
        <span>
          Ln {doc.cursorPosition.line}, Col {doc.cursorPosition.column}
        </span>
      )}
      <span>{MODE_LABELS[mode]}</span>
      {doc && <span>{doc.encoding.toUpperCase()}</span>}
      {doc && <span>{doc.lineEnding.toUpperCase()}</span>}
    </div>
  );
}
