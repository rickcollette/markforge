import { useCallback, useEffect, useRef, useState } from "react";
import {
  ClipboardCopy,
  Download,
  FileDown,
  FilePlus2,
  Image as ImageIcon,
  Maximize,
  Minus,
  Plus,
  Replace,
  Save,
} from "lucide-react";

import MonacoMarkdown from "@/components/editor/MonacoMarkdown";
import ResizeHandle from "@/components/ui/ResizeHandle";
import {
  renderMermaid,
  validateMermaid,
  type MermaidTheme,
} from "@/lib/mermaid/mermaidConfig";
import {
  MERMAID_TEMPLATES,
  asFencedBlock,
} from "@/lib/mermaid/mermaidTemplates";
import { detectDiagramType, replaceMermaidBlock } from "@/lib/mermaid/mermaidParser";
import {
  copyPngToClipboard,
  copySvgToClipboard,
  diagramFilename,
  savePngToFile,
  saveSvgToFile,
} from "@/lib/mermaid/mermaidExport";
import { slugifyTitle } from "@/lib/exporting/exportUtils";
import { pickSavePath } from "@/lib/tauri/dialogs";
import { writeTextFile } from "@/lib/tauri/commands";
import { toastError, useAppStore } from "@/state/appStore";
import { useDocumentStore } from "@/state/documentStore";
import { useSettingsStore } from "@/state/settingsStore";
import type { MermaidError } from "@/lib/types";

export default function MermaidStudio() {
  const source = useAppStore((s) => s.studioSource);
  const setSource = useAppStore((s) => s.setStudioSource);
  const context = useAppStore((s) => s.studioContext);
  const setContext = useAppStore((s) => s.setStudioContext);
  const toast = useAppStore((s) => s.toast);
  const defaultTheme = useSettingsStore(
    (s) => s.settings.mermaid.theme,
  ) as MermaidTheme;

  const [theme, setTheme] = useState<MermaidTheme>(defaultTheme);
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<MermaidError | null>(null);
  const [rendering, setRendering] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [transparentPng, setTransparentPng] = useState(false);
  const [pngScale, setPngScale] = useState(2);
  const viewportRef = useRef<HTMLDivElement>(null);
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const splitRatio = useAppStore((s) => s.studioSplitRatio);
  const dragRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  // Debounced render + validation.
  useEffect(() => {
    setRendering(true);
    const timer = setTimeout(async () => {
      const validation = await validateMermaid(source);
      setError(validation);
      if (!validation) {
        const result = await renderMermaid(source, theme);
        setSvg(result.svg);
        if (result.error) setError(result.error);
      }
      setRendering(false);
    }, 350);
    return () => clearTimeout(timer);
  }, [source, theme]);

  const fitToScreen = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const handleWheel = (e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    setZoom((z) => Math.min(6, Math.max(0.2, z * (e.deltaY < 0 ? 1.12 : 0.89))));
  };

  const diagramType = detectDiagramType(source);
  const baseName = diagramFilename(
    slugifyTitle(context ? "document-diagram" : "diagram"),
    context?.blockIndex ?? 0,
    diagramType,
    "svg",
  ).replace(/\.svg$/, "");

  const act = async (label: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
      toast({ kind: "success", title: label });
    } catch (err) {
      toastError(`${label} failed`, err);
    }
  };

  const insertIntoDocument = () => {
    const docs = useDocumentStore.getState();
    let target = docs.activeDocument();
    if (!target) {
      target = docs.newDocument("", "Untitled-diagram.md");
    }
    const fenced = asFencedBlock(source);
    if (context && context.documentId) {
      const doc = docs.openDocuments.find((d) => d.id === context.documentId);
      if (doc) {
        const replaced = replaceMermaidBlock(
          doc.content,
          context.blockIndex,
          fenced.split("\n").slice(1, -1).join("\n"),
        );
        if (replaced !== null) {
          docs.setContent(doc.id, replaced);
          docs.activate(doc.id);
          useAppStore.getState().setEditorMode("split");
          toast({ kind: "success", title: "Diagram block replaced" });
          setContext(null);
          return;
        }
      }
    }
    docs.setContent(
      target.id,
      target.content + (target.content.endsWith("\n") || !target.content ? "" : "\n") + "\n" + fenced + "\n",
    );
    docs.activate(target.id);
    useAppStore.getState().setEditorMode("split");
    toast({ kind: "success", title: "Diagram inserted into document" });
  };

  return (
    <div className="flex h-full flex-col">
      {/* Studio toolbar */}
      <div
        className="flex shrink-0 flex-wrap items-center gap-1.5 border-b px-2 py-1.5"
        style={{
          background: "var(--bg-panel)",
          borderColor: "var(--border-subtle)",
        }}
      >
        <select
          className="input w-44"
          style={{ width: 170 }}
          value=""
          aria-label="Insert template"
          onChange={(e) => {
            const t = MERMAID_TEMPLATES.find((x) => x.id === e.target.value);
            if (t) {
              setContext(null);
              setSource(t.source);
            }
          }}
        >
          <option value="" disabled>
            Templates…
          </option>
          {MERMAID_TEMPLATES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select
          className="input"
          style={{ width: 110 }}
          value={theme}
          aria-label="Diagram theme"
          onChange={(e) => setTheme(e.target.value as MermaidTheme)}
        >
          {["default", "dark", "forest", "neutral"].map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <span
          className="rounded px-1.5 py-0.5 text-[11px]"
          style={{ background: "var(--accent-bg)", color: "var(--accent)" }}
        >
          {diagramType}
        </span>

        <span className="flex-1" />

        <button
          className="btn"
          title="Copy mermaid source"
          onClick={() =>
            void act("Source copied", () =>
              navigator.clipboard.writeText(source),
            )
          }
        >
          <ClipboardCopy size={13} /> Source
        </button>
        <button
          className="btn"
          disabled={!svg}
          title="Copy as SVG markup"
          onClick={() => svg && void act("SVG copied", () => copySvgToClipboard(svg))}
        >
          <ClipboardCopy size={13} /> SVG
        </button>
        <button
          className="btn"
          disabled={!svg}
          title="Copy as PNG image"
          onClick={() => svg && void act("PNG copied", () => copyPngToClipboard(svg))}
        >
          <ImageIcon size={13} /> PNG
        </button>
        <button
          className="btn"
          disabled={!svg}
          title="Export diagram as SVG file"
          onClick={() =>
            svg && void act("SVG exported", () => saveSvgToFile(svg, `${baseName}.svg`))
          }
        >
          <Download size={13} /> SVG file
        </button>
        <button
          className="btn"
          disabled={!svg}
          title={`Export diagram as PNG file (scale ${pngScale}x${transparentPng ? ", transparent" : ""})`}
          onClick={() =>
            svg &&
            void act("PNG exported", () =>
              savePngToFile(svg, `${baseName}.png`, {
                scale: pngScale,
                transparent: transparentPng,
              }),
            )
          }
        >
          <Download size={13} /> PNG file
        </button>
        <button
          className="btn"
          title="Save as standalone .mmd file"
          onClick={() =>
            void act("Diagram saved", async () => {
              const path = await pickSavePath(`${baseName}.mmd`, "mmd", "Mermaid");
              if (path) await writeTextFile(path, source);
            })
          }
        >
          <Save size={13} /> .mmd
        </button>
        <button className="btn btn-primary" onClick={insertIntoDocument}>
          {context ? (
            <>
              <Replace size={13} /> Replace block
            </>
          ) : (
            <>
              <FilePlus2 size={13} /> Insert into document
            </>
          )}
        </button>
      </div>

      <div ref={splitContainerRef} className="flex min-h-0 flex-1">
        {/* Source editor + validation */}
        <div
          className="flex min-w-0 flex-col border-r"
          style={{
            width: `${splitRatio * 100}%`,
            borderColor: "var(--border-subtle)",
          }}
        >
          <div className="min-h-0 flex-1">
            <MonacoMarkdown
              documentId="mermaid-studio"
              path="inmemory://mermaid-studio.mmd"
              language="mermaid"
              value={source}
              onChange={setSource}
            />
          </div>
          <div
            className="shrink-0 border-t px-3 py-2 text-xs"
            style={{
              borderColor: "var(--border-subtle)",
              background: "var(--bg-panel)",
              minHeight: 56,
            }}
            role="status"
            aria-label="Validation results"
          >
            {error ? (
              <div style={{ color: "var(--danger)" }} className="select-text">
                <strong>
                  Error{error.line ? ` (line ${error.line})` : ""}:
                </strong>{" "}
                {error.message}
              </div>
            ) : (
              <span style={{ color: "var(--success)" }}>
                ✓ Diagram is valid{rendering ? " — rendering…" : ""}
              </span>
            )}
          </div>
        </div>

        <ResizeHandle
          label="Resize studio split"
          onDelta={(dx) => {
            const total = splitContainerRef.current?.clientWidth ?? 0;
            if (total <= 0) return;
            const s = useAppStore.getState();
            s.setStudioSplitRatio(s.studioSplitRatio + dx / total);
          }}
          onReset={() => useAppStore.getState().setStudioSplitRatio(0.5)}
        />

        {/* Preview with zoom/pan */}
        <div className="relative flex min-w-0 flex-1 flex-col">
          <div
            ref={viewportRef}
            className="min-h-0 flex-1 overflow-hidden"
            style={{
              background: "var(--bg-app)",
              cursor: dragRef.current ? "grabbing" : "grab",
            }}
            onWheel={handleWheel}
            onPointerDown={(e) => {
              dragRef.current = {
                x: e.clientX,
                y: e.clientY,
                panX: pan.x,
                panY: pan.y,
              };
              (e.target as HTMLElement).setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              const d = dragRef.current;
              if (!d) return;
              setPan({
                x: d.panX + (e.clientX - d.x),
                y: d.panY + (e.clientY - d.y),
              });
            }}
            onPointerUp={() => {
              dragRef.current = null;
            }}
          >
            <div
              className="flex h-full items-center justify-center"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: "center center",
                transition: dragRef.current ? "none" : "transform 80ms ease-out",
              }}
            >
              {svg ? (
                <div
                  // SVG is sanitized in renderMermaid.
                  dangerouslySetInnerHTML={{ __html: svg }}
                />
              ) : (
                <span style={{ color: "var(--text-muted)" }}>
                  {rendering ? "Rendering…" : "Fix the diagram to see a preview"}
                </span>
              )}
            </div>
          </div>

          {/* Zoom controls */}
          <div
            className="absolute right-3 top-3 flex items-center gap-1 rounded-lg border p-1"
            style={{
              background: "var(--bg-panel-elevated)",
              borderColor: "var(--border-subtle)",
            }}
          >
            <button className="icon-btn" title="Zoom out" onClick={() => setZoom((z) => Math.max(0.2, z * 0.85))}>
              <Minus size={13} />
            </button>
            <span className="w-10 text-center text-[11px]" style={{ color: "var(--text-secondary)" }}>
              {Math.round(zoom * 100)}%
            </span>
            <button className="icon-btn" title="Zoom in" onClick={() => setZoom((z) => Math.min(6, z * 1.18))}>
              <Plus size={13} />
            </button>
            <button className="icon-btn" title="Fit to screen" onClick={fitToScreen}>
              <Maximize size={13} />
            </button>
          </div>

          {/* PNG export options */}
          <div
            className="absolute bottom-3 right-3 flex items-center gap-2 rounded-lg border px-2 py-1 text-[11px]"
            style={{
              background: "var(--bg-panel-elevated)",
              borderColor: "var(--border-subtle)",
              color: "var(--text-secondary)",
            }}
          >
            <FileDown size={12} />
            <label className="flex items-center gap-1">
              Scale
              <select
                className="input"
                style={{ width: 52, height: 22 }}
                value={pngScale}
                onChange={(e) => setPngScale(Number(e.target.value))}
              >
                {[1, 2, 3, 4].map((s) => (
                  <option key={s} value={s}>
                    {s}x
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={transparentPng}
                onChange={(e) => setTransparentPng(e.target.checked)}
              />
              Transparent
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
