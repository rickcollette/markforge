import { Clock, FolderOpen } from "lucide-react";

import { useDocumentStore } from "@/state/documentStore";
import { useWorkspaceStore } from "@/state/workspaceStore";

export default function RecentFiles() {
  const recentFiles = useDocumentStore((s) => s.recentFiles);
  const recentWorkspaces = useWorkspaceStore((s) => s.recentWorkspaces);
  const openPath = useDocumentStore((s) => s.openPath);
  const openWorkspacePath = useWorkspaceStore((s) => s.openWorkspacePath);

  return (
    <div className="flex h-full flex-col gap-2 overflow-y-auto p-2">
      <div>
        <h3
          className="px-1 pb-1 text-[11px] font-bold uppercase tracking-wide"
          style={{ color: "var(--text-muted)" }}
        >
          Recent Files
        </h3>
        {recentFiles.length === 0 && (
          <p className="px-1 text-xs" style={{ color: "var(--text-muted)" }}>
            No recent files yet.
          </p>
        )}
        {recentFiles.map((f) => (
          <button
            key={f.path}
            className="tree-row w-full text-left"
            title={f.path}
            onClick={() => void openPath(f.path, { allow: true })}
          >
            <Clock size={13} className="shrink-0" />
            <span className="truncate">{f.title}</span>
          </button>
        ))}
      </div>
      <div>
        <h3
          className="px-1 pb-1 text-[11px] font-bold uppercase tracking-wide"
          style={{ color: "var(--text-muted)" }}
        >
          Recent Workspaces
        </h3>
        {recentWorkspaces.length === 0 && (
          <p className="px-1 text-xs" style={{ color: "var(--text-muted)" }}>
            No recent workspaces yet.
          </p>
        )}
        {recentWorkspaces.map((w) => (
          <button
            key={w.path}
            className="tree-row w-full text-left"
            title={w.path}
            onClick={() => void openWorkspacePath(w.path)}
          >
            <FolderOpen size={13} className="shrink-0" />
            <span className="truncate">{w.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
