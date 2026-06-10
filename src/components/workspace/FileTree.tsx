import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  File,
  FileText,
  Folder,
  FolderOpen,
  FilePlus,
  FolderPlus,
  RefreshCw,
  Filter,
} from "lucide-react";
import { revealItemInDir } from "@tauri-apps/plugin-opener";

import type { FileEntry } from "@/lib/types";
import * as backend from "@/lib/tauri/commands";
import { confirmDialog } from "@/lib/tauri/dialogs";
import { useWorkspaceStore } from "@/state/workspaceStore";
import { useDocumentStore } from "@/state/documentStore";
import { useSettingsStore } from "@/state/settingsStore";
import { toastError } from "@/state/appStore";
import PromptModal from "@/components/ui/PromptModal";

const MD_EXTENSIONS = ["md", "markdown", "mdown", "mkd", "mmd", "mermaid"];

type TreeNode = FileEntry & { children: TreeNode[] };

function buildTree(root: string, entries: FileEntry[]): TreeNode[] {
  const byPath = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];
  const sorted = [...entries].sort((a, b) => a.path.length - b.path.length);
  for (const entry of sorted) {
    const node: TreeNode = { ...entry, children: [] };
    byPath.set(entry.path, node);
    const sep = entry.path.includes("\\") ? "\\" : "/";
    const parentPath = entry.path.slice(0, entry.path.lastIndexOf(sep));
    const parent = byPath.get(parentPath);
    if (parent && parentPath !== entry.path) {
      parent.children.push(node);
    } else if (
      parentPath === root ||
      parentPath === root.replace(/[\\/]+$/, "")
    ) {
      roots.push(node);
    } else {
      roots.push(node);
    }
  }
  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort(
      (a, b) =>
        Number(b.isDir) - Number(a.isDir) ||
        a.name.toLowerCase().localeCompare(b.name.toLowerCase()),
    );
    nodes.forEach((n) => sortNodes(n.children));
  };
  sortNodes(roots);
  return roots;
}

type ContextTarget = { x: number; y: number; node: TreeNode | null };
type PromptState =
  | { kind: "new-file" | "new-folder"; dir: string }
  | { kind: "rename"; node: TreeNode }
  | null;

export default function FileTree() {
  const { workspacePath, workspaceName, entries, git, refresh } =
    useWorkspaceStore();
  const openPath = useDocumentStore((s) => s.openPath);
  const notePathRenamed = useDocumentStore((s) => s.notePathRenamed);
  const confirmBeforeDelete = useSettingsStore(
    (s) => s.settings.files.confirmBeforeDelete,
  );
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [mdOnly, setMdOnly] = useState(false);
  const [context, setContext] = useState<ContextTarget | null>(null);
  const [prompt, setPrompt] = useState<PromptState>(null);

  const gitMap = useMemo(() => {
    const map = new Map<string, string>();
    git?.files.forEach((f) => map.set(f.path.toLowerCase(), f.status));
    return map;
  }, [git]);

  const tree = useMemo(() => {
    if (!workspacePath) return [];
    let filtered = entries;
    if (mdOnly) {
      const keepDirs = new Set<string>();
      const files = entries.filter(
        (e) => !e.isDir && MD_EXTENSIONS.includes(e.extension ?? ""),
      );
      for (const file of files) {
        let p = file.path;
        const sep = p.includes("\\") ? "\\" : "/";
        while (p.length > workspacePath.length) {
          p = p.slice(0, p.lastIndexOf(sep));
          keepDirs.add(p);
        }
      }
      filtered = entries.filter(
        (e) =>
          (!e.isDir && MD_EXTENSIONS.includes(e.extension ?? "")) ||
          (e.isDir && keepDirs.has(e.path)),
      );
    }
    return buildTree(workspacePath, filtered);
  }, [entries, workspacePath, mdOnly]);

  if (!workspacePath) {
    return (
      <div className="flex flex-col items-center gap-3 p-6 text-center">
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          No workspace open
        </p>
        <button
          className="btn btn-primary"
          onClick={() => useWorkspaceStore.getState().openFolderDialog()}
        >
          Open Folder
        </button>
      </div>
    );
  }

  const toggleExpand = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const sep = workspacePath.includes("\\") ? "\\" : "/";

  const handleDelete = async (node: TreeNode) => {
    if (confirmBeforeDelete) {
      const ok = await confirmDialog(
        `Delete "${node.name}"${node.isDir ? " and all its contents" : ""}?`,
        "Delete",
      );
      if (!ok) return;
    }
    try {
      await backend.deleteFile(node.path);
      await refresh();
    } catch (err) {
      toastError("Could not delete", err);
    }
  };

  const handlePromptConfirm = async (value: string) => {
    const p = prompt;
    setPrompt(null);
    if (!p) return;
    try {
      if (p.kind === "new-file") {
        const path = `${p.dir}${sep}${value}`;
        await backend.createFile(path, "");
        await refresh();
        if (/\.(md|markdown|mmd)$/i.test(value)) await openPath(path);
      } else if (p.kind === "new-folder") {
        await backend.createDirectory(`${p.dir}${sep}${value}`);
        await refresh();
      } else if (p.kind === "rename") {
        const dir = p.node.path.slice(0, p.node.path.lastIndexOf(sep));
        const newPath = `${dir}${sep}${value}`;
        await backend.renameFile(p.node.path, newPath);
        notePathRenamed(p.node.path, newPath);
        await refresh();
      }
    } catch (err) {
      toastError("File operation failed", err);
    }
  };

  const renderNode = (node: TreeNode, depth: number) => {
    const isExpanded = expanded.has(node.path);
    const gitStatus = gitMap.get(node.path.toLowerCase());
    const isMarkdown = MD_EXTENSIONS.includes(node.extension ?? "");
    return (
      <div key={node.path}>
        <div
          className="tree-row"
          style={{ paddingLeft: depth * 14 + 4 }}
          onClick={() => {
            if (node.isDir) toggleExpand(node.path);
            else if (isMarkdown || node.extension === "txt")
              void openPath(node.path);
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            setContext({ x: e.clientX, y: e.clientY, node });
          }}
          title={node.path}
        >
          {node.isDir ? (
            <>
              {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              {isExpanded ? (
                <FolderOpen size={14} color="var(--accent)" />
              ) : (
                <Folder size={14} color="var(--accent)" />
              )}
            </>
          ) : (
            <>
              <span style={{ width: 13 }} />
              {isMarkdown ? (
                <FileText size={14} color="var(--text-secondary)" />
              ) : (
                <File size={14} color="var(--text-muted)" />
              )}
            </>
          )}
          <span className="truncate">{node.name}</span>
          {gitStatus && (
            <span
              className="ml-auto pr-1 text-[10px] font-bold uppercase"
              style={{
                color:
                  gitStatus === "new" || gitStatus === "added"
                    ? "var(--success)"
                    : gitStatus === "deleted"
                      ? "var(--danger)"
                      : "var(--warning)",
              }}
            >
              {gitStatus[0]}
            </span>
          )}
        </div>
        {node.isDir && isExpanded && (
          <div>{node.children.map((child) => renderNode(child, depth + 1))}</div>
        )}
      </div>
    );
  };

  return (
    <div
      className="flex h-full flex-col"
      onContextMenu={(e) => {
        if (e.target === e.currentTarget) {
          e.preventDefault();
          setContext({ x: e.clientX, y: e.clientY, node: null });
        }
      }}
    >
      <div className="flex items-center gap-1 px-2 py-1.5">
        <span
          className="flex-1 truncate text-[11px] font-bold uppercase tracking-wide"
          style={{ color: "var(--text-muted)" }}
          title={workspacePath}
        >
          {workspaceName}
        </span>
        <button
          className="icon-btn"
          title="New file"
          onClick={() => setPrompt({ kind: "new-file", dir: workspacePath })}
        >
          <FilePlus size={13} />
        </button>
        <button
          className="icon-btn"
          title="New folder"
          onClick={() => setPrompt({ kind: "new-folder", dir: workspacePath })}
        >
          <FolderPlus size={13} />
        </button>
        <button
          className="icon-btn"
          data-active={mdOnly}
          title="Show Markdown files only"
          onClick={() => setMdOnly((v) => !v)}
        >
          <Filter size={13} />
        </button>
        <button className="icon-btn" title="Refresh" onClick={() => void refresh()}>
          <RefreshCw size={13} />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-1 pb-2">
        {tree.map((node) => renderNode(node, 0))}
      </div>

      {context && (
        <>
          <div
            className="fixed inset-0 z-[80]"
            onClick={() => setContext(null)}
            onContextMenu={(e) => {
              e.preventDefault();
              setContext(null);
            }}
          />
          <div
            className="menu-content fixed z-[85]"
            style={{ left: context.x, top: context.y }}
            role="menu"
          >
            {(() => {
              const node = context.node;
              const dir = node
                ? node.isDir
                  ? node.path
                  : node.path.slice(0, node.path.lastIndexOf(sep))
                : workspacePath;
              const item = (
                label: string,
                action: () => void,
                disabled = false,
              ) => (
                <button
                  key={label}
                  className="menu-item w-full text-left"
                  data-disabled={disabled || undefined}
                  disabled={disabled}
                  onClick={() => {
                    setContext(null);
                    action();
                  }}
                >
                  {label}
                </button>
              );
              const items = [
                item("New File…", () => setPrompt({ kind: "new-file", dir })),
                item("New Folder…", () =>
                  setPrompt({ kind: "new-folder", dir }),
                ),
              ];
              if (node) {
                items.push(
                  item("Rename…", () => setPrompt({ kind: "rename", node })),
                  item(
                    "Duplicate",
                    async () => {
                      try {
                        await backend.duplicateFile(node.path);
                        await refresh();
                      } catch (err) {
                        toastError("Could not duplicate", err);
                      }
                    },
                    node.isDir,
                  ),
                  item("Delete", () => void handleDelete(node)),
                  item("Reveal in File Manager", () =>
                    void revealItemInDir(node.path).catch((err) =>
                      toastError("Could not reveal", err),
                    ),
                  ),
                );
                if (!node.isDir && MD_EXTENSIONS.includes(node.extension ?? "")) {
                  items.push(
                    item("Open", () => void openPath(node.path)),
                  );
                }
              }
              return items;
            })()}
          </div>
        </>
      )}

      <PromptModal
        open={prompt !== null}
        title={
          prompt?.kind === "new-file"
            ? "New File"
            : prompt?.kind === "new-folder"
              ? "New Folder"
              : "Rename"
        }
        label={
          prompt?.kind === "rename"
            ? "New name"
            : prompt?.kind === "new-folder"
              ? "Folder name"
              : "File name (e.g. notes.md)"
        }
        initialValue={prompt?.kind === "rename" ? prompt.node.name : ""}
        onConfirm={(v) => void handlePromptConfirm(v)}
        onCancel={() => setPrompt(null)}
      />
    </div>
  );
}