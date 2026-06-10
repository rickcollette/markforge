import { useCallback, useEffect, useMemo, useState } from "react";
import { ImagePlus, RefreshCw } from "lucide-react";

import { extractLinks } from "@/lib/markdown/markdownLinter";
import * as backend from "@/lib/tauri/commands";
import { pickImageFile } from "@/lib/tauri/dialogs";
import { editorBridge, useActiveDocument } from "@/state/documentStore";
import { useWorkspaceStore } from "@/state/workspaceStore";
import { toastError, useAppStore } from "@/state/appStore";
import type { FileEntry } from "@/lib/types";

const IMAGE_EXTS = ["png", "jpg", "jpeg", "gif", "svg", "webp", "bmp", "ico"];

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

/** Compute a relative path from a document's folder to a target file. */
export function relativePath(fromDir: string, to: string): string {
  const fromParts = fromDir.split(/[\\/]/).filter(Boolean);
  const toParts = to.split(/[\\/]/).filter(Boolean);
  let common = 0;
  while (
    common < fromParts.length &&
    common < toParts.length &&
    fromParts[common].toLowerCase() === toParts[common].toLowerCase()
  ) {
    common++;
  }
  const ups = fromParts.length - common;
  const down = toParts.slice(common);
  return [...Array(ups).fill(".."), ...down].join("/");
}

export default function AssetManagerPanel() {
  const doc = useActiveDocument();
  const { workspacePath, workspaceSettings, entries } = useWorkspaceStore();
  const [missing, setMissing] = useState<Set<string>>(new Set());
  const toast = useAppStore((s) => s.toast);

  const imageLinks = useMemo(
    () =>
      doc ? extractLinks(doc.content).filter((l) => l.kind === "image") : [],
    [doc?.content, doc],
  );

  const assetsFolder = workspaceSettings?.assetsFolder || "assets";

  const workspaceImages: FileEntry[] = useMemo(
    () =>
      entries.filter(
        (e) => !e.isDir && IMAGE_EXTS.includes(e.extension ?? ""),
      ),
    [entries],
  );

  const referencedFullPaths = useMemo(() => {
    if (!doc?.path) return new Set<string>();
    const dir = dirOf(doc.path);
    return new Set(
      imageLinks
        .filter((l) => !/^https?:/i.test(l.target))
        .map((l) =>
          resolveRelative(dir, decodeURIComponent(l.target.split("#")[0]))
            .toLowerCase(),
        ),
    );
  }, [imageLinks, doc?.path]);

  const unusedAssets = useMemo(
    () =>
      workspaceImages.filter(
        (img) => !referencedFullPaths.has(img.path.toLowerCase()),
      ),
    [workspaceImages, referencedFullPaths],
  );

  const checkMissing = useCallback(async () => {
    if (!doc?.path) return;
    const dir = dirOf(doc.path);
    const next = new Set<string>();
    for (const link of imageLinks) {
      if (/^https?:/i.test(link.target)) continue;
      const full = resolveRelative(
        dir,
        decodeURIComponent(link.target.split("#")[0]),
      );
      try {
        if (!(await backend.fileExists(full))) next.add(link.target);
      } catch {
        next.add(link.target);
      }
    }
    setMissing(next);
  }, [imageLinks, doc?.path]);

  useEffect(() => {
    void checkMissing();
  }, [checkMissing]);

  const addImageToAssets = async () => {
    if (!doc) return;
    try {
      const source = await pickImageFile();
      if (!source) return;
      const baseDir = workspacePath ?? (doc.path ? dirOf(doc.path) : null);
      if (!baseDir) {
        toast({
          kind: "warning",
          title: "Save the document first so assets can be stored next to it.",
        });
        return;
      }
      const destDir = `${baseDir}${baseDir.includes("\\") ? "\\" : "/"}${assetsFolder}`;
      await backend.allowPath(baseDir).catch(() => {});
      const copied = await backend.copyFileInto(source, destDir);
      const rel = doc.path
        ? relativePath(dirOf(doc.path), copied)
        : copied;
      editorBridge()?.insertText(`![](${rel.replace(/\\/g, "/")})`);
      toast({ kind: "success", title: "Image copied to assets" });
      void useWorkspaceStore.getState().refresh();
    } catch (err) {
      toastError("Could not add image", err);
    }
  };

  if (!doc) {
    return (
      <p className="p-4 text-xs" style={{ color: "var(--text-muted)" }}>
        Open a document to manage its image assets.
      </p>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto p-2">
      <div className="flex items-center gap-1 px-1 pb-2">
        <h3
          className="flex-1 text-[11px] font-bold uppercase tracking-wide"
          style={{ color: "var(--text-muted)" }}
        >
          Image Assets
        </h3>
        <button
          className="icon-btn"
          title="Copy an image into the assets folder and insert it"
          onClick={() => void addImageToAssets()}
        >
          <ImagePlus size={13} />
        </button>
        <button className="icon-btn" title="Re-check" onClick={() => void checkMissing()}>
          <RefreshCw size={13} />
        </button>
      </div>

      <h4 className="px-1 pb-1 text-[11px] font-semibold" style={{ color: "var(--text-secondary)" }}>
        Used in this document ({imageLinks.length})
      </h4>
      {imageLinks.length === 0 && (
        <p className="px-1 pb-2 text-xs" style={{ color: "var(--text-muted)" }}>
          No images referenced.
        </p>
      )}
      {imageLinks.map((link, i) => (
        <button
          key={i}
          className="tree-row w-full text-left"
          onClick={() => editorBridge()?.goToLine(link.line)}
          title={link.target}
        >
          <span
            className="truncate text-xs"
            style={{
              color: missing.has(link.target)
                ? "var(--danger)"
                : "var(--text-secondary)",
            }}
          >
            {missing.has(link.target) ? "✕ " : ""}
            {link.target}
          </span>
        </button>
      ))}

      {workspacePath && (
        <>
          <h4
            className="px-1 pb-1 pt-3 text-[11px] font-semibold"
            style={{ color: "var(--text-secondary)" }}
          >
            Unused workspace images ({unusedAssets.length})
          </h4>
          {unusedAssets.slice(0, 100).map((img) => (
            <button
              key={img.path}
              className="tree-row w-full text-left"
              title={`Insert reference to ${img.path}`}
              onClick={() => {
                if (!doc.path) return;
                const rel = relativePath(dirOf(doc.path), img.path);
                editorBridge()?.insertText(`![](${rel.replace(/\\/g, "/")})`);
              }}
            >
              <span className="truncate text-xs">{img.name}</span>
            </button>
          ))}
        </>
      )}
    </div>
  );
}
