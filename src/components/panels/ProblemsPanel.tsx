import { AlertTriangle, Info, XCircle } from "lucide-react";

import { useAppStore } from "@/state/appStore";
import { editorBridge, useActiveDocument } from "@/state/documentStore";

const ICONS = {
  error: <XCircle size={13} color="var(--danger)" />,
  warning: <AlertTriangle size={13} color="var(--warning)" />,
  info: <Info size={13} color="var(--accent)" />,
};

export default function ProblemsPanel() {
  const findings = useAppStore((s) => s.lintFindings);
  const doc = useActiveDocument();

  if (!doc) {
    return (
      <p className="p-4 text-xs" style={{ color: "var(--text-muted)" }}>
        Open a document to lint it.
      </p>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-2">
      <h3
        className="px-1 pb-1 text-[11px] font-bold uppercase tracking-wide"
        style={{ color: "var(--text-muted)" }}
      >
        Problems ({findings.length})
      </h3>
      {findings.length === 0 && (
        <p
          className="px-1 text-xs"
          style={{ color: "var(--success)" }}
        >
          No lint findings. Nice document.
        </p>
      )}
      {findings.map((f) => (
        <button
          key={f.id}
          className="tree-row w-full text-left"
          style={{ height: "auto", padding: "4px 6px" }}
          title={`${f.source} · line ${f.line}`}
          onClick={() => editorBridge()?.goToLine(f.line, f.column)}
        >
          <span className="shrink-0">{ICONS[f.severity]}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs">{f.message}</span>
            <span
              className="block text-[10.5px]"
              style={{ color: "var(--text-muted)" }}
            >
              {f.source} · line {f.line}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}
