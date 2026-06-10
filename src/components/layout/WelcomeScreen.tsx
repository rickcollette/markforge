import { FilePlus, FolderOpen, FileText, LayoutTemplate } from "lucide-react";

import { useDocumentStore } from "@/state/documentStore";
import { useWorkspaceStore } from "@/state/workspaceStore";
import { useAppStore } from "@/state/appStore";
import { formatShortcut } from "@/lib/commands/keymap";

export default function WelcomeScreen() {
  const newDocument = useDocumentStore((s) => s.newDocument);
  const openFileDialog = useDocumentStore((s) => s.openFileDialog);
  const recentFiles = useDocumentStore((s) => s.recentFiles);
  const openPath = useDocumentStore((s) => s.openPath);
  const openFolderDialog = useWorkspaceStore((s) => s.openFolderDialog);
  const openDialog = useAppStore((s) => s.openDialog);

  return (
    <div
      className="flex h-full flex-col items-center justify-center gap-6"
      style={{ background: "var(--bg-app)" }}
    >
      <div className="flex flex-col items-center text-center">
        <img
          src="/Logo_Icon_Large.png"
          alt=""
          className="h-24 w-24"
          draggable={false}
        />
        <img
          src="/Logo_Lettering_Large.png"
          alt="MarkForge"
          className="brand-dark-adapt mt-3 h-9"
          draggable={false}
        />
        <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
          Markdown editing with first-class Mermaid diagrams
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {[
          {
            icon: FilePlus,
            label: "New File",
            hint: formatShortcut("mod+n"),
            action: () => void newDocument(),
          },
          {
            icon: FolderOpen,
            label: "Open File",
            hint: formatShortcut("mod+o"),
            action: () => void openFileDialog(),
          },
          {
            icon: FolderOpen,
            label: "Open Folder",
            hint: formatShortcut("mod+k mod+o"),
            action: () => void openFolderDialog(),
          },
          {
            icon: LayoutTemplate,
            label: "New From Template",
            hint: "",
            action: () => openDialog("templates"),
          },
        ].map(({ icon: Icon, label, hint, action }) => (
          <button
            key={label}
            className="flex w-52 items-center gap-3 rounded-lg border px-4 py-3 text-left hover:!border-[var(--accent)]"
            style={{
              borderColor: "var(--border-subtle)",
              background: "var(--bg-panel)",
            }}
            onClick={action}
          >
            <Icon size={18} color="var(--accent)" />
            <span className="flex-1 text-xs font-medium">{label}</span>
            {hint && (
              <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                {hint}
              </span>
            )}
          </button>
        ))}
      </div>

      {recentFiles.length > 0 && (
        <div className="w-[27rem]">
          <h2
            className="pb-1.5 text-[11px] font-bold uppercase tracking-wide"
            style={{ color: "var(--text-muted)" }}
          >
            Recent files
          </h2>
          {recentFiles.slice(0, 6).map((f) => (
            <button
              key={f.path}
              className="tree-row w-full text-left"
              title={f.path}
              onClick={() => void openPath(f.path, { allow: true })}
            >
              <FileText size={13} className="shrink-0" />
              <span className="truncate">{f.title}</span>
              <span
                className="ml-auto truncate pl-3 text-[10.5px]"
                style={{ color: "var(--text-muted)", maxWidth: "55%" }}
              >
                {f.path}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
