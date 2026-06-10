import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { toastError, useAppStore } from "@/state/appStore";
import { useActiveDocument } from "@/state/documentStore";
import { useSettingsStore } from "@/state/settingsStore";
import * as backend from "@/lib/tauri/commands";
import { pickFolder, pickSavePath } from "@/lib/tauri/dialogs";
import {
  buildRevealHtml,
  DEFAULT_PDF_OPTIONS,
  markdownToPlainText,
  previewCss,
  printHtml,
  renderFullHtml,
  slugifyTitle,
  stringToBase64,
  type PdfOptions,
} from "@/lib/exporting/exportUtils";
import { cleanMarkdown } from "@/lib/markdown/markdownFormatter";
import { extractMermaidBlocks } from "@/lib/mermaid/mermaidParser";
import { renderMermaid, type MermaidTheme } from "@/lib/mermaid/mermaidConfig";
import {
  bytesToBase64,
  diagramFilename,
  svgToPngBytes,
} from "@/lib/mermaid/mermaidExport";

type Format =
  | "html"
  | "pdf"
  | "docx"
  | "markdown"
  | "txt"
  | "reveal"
  | "diagrams-svg"
  | "diagrams-png";

type HistoryEntry = {
  format: string;
  filename: string;
  exportedAt: string;
};

const FORMAT_LABELS: Record<Format, string> = {
  html: "HTML document",
  pdf: "PDF (via system print dialog)",
  docx: "Word document (built-in DOCX)",
  markdown: "Markdown (cleaned)",
  txt: "Plain text",
  reveal: "Reveal.js slides (single HTML)",
  "diagrams-svg": "All Mermaid diagrams as SVG",
  "diagrams-png": "All Mermaid diagrams as PNG",
};

export default function ExportDialog() {
  const open = useAppStore((s) => s.activeDialog === "export");
  const closeDialog = useAppStore((s) => s.closeDialog);
  const toast = useAppStore((s) => s.toast);
  const doc = useActiveDocument();
  const settings = useSettingsStore((s) => s.settings);

  const [format, setFormat] = useState<Format>("html");
  const [includeMermaid, setIncludeMermaid] = useState(true);
  const [pdfOptions, setPdfOptions] = useState<PdfOptions>(DEFAULT_PDF_OPTIONS);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    if (open) {
      setFormat((settings.export.defaultFormat as Format) || "html");
      setIncludeMermaid(settings.export.includeMermaidDiagrams);
      void backend
        .loadAppData<HistoryEntry[]>("export-history")
        .then((h) => Array.isArray(h) && setHistory(h));
    }
  }, [open, settings.export]);

  if (!doc) return null;

  const mermaidTheme = settings.mermaid.theme as MermaidTheme;
  const slug = slugifyTitle(doc.title);
  const isDark = document.documentElement.classList.contains("dark");

  const recordHistory = async (filename: string) => {
    const entry: HistoryEntry = {
      format,
      filename,
      exportedAt: new Date().toISOString(),
    };
    const next = [entry, ...history].slice(0, 20);
    setHistory(next);
    await backend.saveAppData("export-history", next).catch(() => {});
  };

  const exportDiagrams = async (kind: "svg" | "png") => {
    const blocks = extractMermaidBlocks(doc.content);
    if (blocks.length === 0) {
      toast({ kind: "warning", title: "No Mermaid diagrams in this document" });
      return;
    }
    const folder = await pickFolder("Choose export folder");
    if (!folder) return;
    const sep = folder.includes("\\") ? "\\" : "/";
    let exported = 0;
    for (const block of blocks) {
      const result = await renderMermaid(block.source, mermaidTheme);
      if (!result.svg) continue;
      const name = diagramFilename(slug, block.index, block.type, kind);
      const path = `${folder}${sep}${name}`;
      if (kind === "svg") {
        await backend.writeBinaryFile(
          path,
          stringToBase64(result.svg),
        );
      } else {
        const bytes = await svgToPngBytes(result.svg, { scale: 2 });
        await backend.writeBinaryFile(path, bytesToBase64(bytes));
      }
      exported++;
    }
    toast({
      kind: "success",
      title: `Exported ${exported} of ${blocks.length} diagram(s)`,
    });
    await recordHistory(`${exported} diagrams (${kind})`);
  };

  const run = async () => {
    setBusy(true);
    try {
      switch (format) {
        case "html": {
          const body = await renderFullHtml(doc.content, {
            mermaidTheme,
            includeMermaid,
            previewTheme: settings.preview.theme,
          });
          const result = await backend.exportMarkdownToHtml(doc.content, body, {
            title: doc.title.replace(/\.md$/i, ""),
            inlineCss: settings.export.includeStyles ? previewCss(isDark) : "",
            includeToc: false,
            language: "en",
          });
          const path = await pickSavePath(result.suggestedFilename, "html", "HTML");
          if (!path) break;
          await backend.saveExportedFile(path, result.bytesBase64);
          toast({ kind: "success", title: "HTML exported" });
          await recordHistory(result.suggestedFilename);
          closeDialog();
          break;
        }
        case "pdf": {
          const body = await renderFullHtml(doc.content, {
            mermaidTheme,
            includeMermaid,
            previewTheme: settings.preview.theme,
          });
          closeDialog();
          printHtml(body, pdfOptions);
          await recordHistory(`${slug}.pdf (print dialog)`);
          break;
        }
        case "docx": {
          const blocks = extractMermaidBlocks(doc.content);
          const pngs: (string | null)[] = [];
          for (const block of blocks) {
            if (!includeMermaid) {
              pngs.push(null);
              continue;
            }
            const rendered = await renderMermaid(block.source, mermaidTheme);
            if (rendered.svg) {
              try {
                const bytes = await svgToPngBytes(rendered.svg, { scale: 2 });
                pngs.push(bytesToBase64(bytes));
              } catch {
                pngs.push(null);
              }
            } else {
              pngs.push(null);
            }
          }
          const result = await backend.exportMarkdownToDocx(doc.content, {
            title: doc.title.replace(/\.md$/i, ""),
            diagramPngsBase64: pngs,
          });
          const path = await pickSavePath(result.suggestedFilename, "docx", "Word Document");
          if (!path) break;
          await backend.saveExportedFile(path, result.bytesBase64);
          toast({ kind: "success", title: "DOCX exported (built-in converter)" });
          await recordHistory(result.suggestedFilename);
          closeDialog();
          break;
        }
        case "markdown": {
          const path = await pickSavePath(`${slug}.md`, "md", "Markdown");
          if (!path) break;
          await backend.writeTextFile(path, cleanMarkdown(doc.content));
          toast({ kind: "success", title: "Markdown exported" });
          await recordHistory(`${slug}.md`);
          closeDialog();
          break;
        }
        case "txt": {
          const path = await pickSavePath(`${slug}.txt`, "txt", "Plain Text");
          if (!path) break;
          await backend.writeTextFile(path, markdownToPlainText(doc.content));
          toast({ kind: "success", title: "Plain text exported" });
          await recordHistory(`${slug}.txt`);
          closeDialog();
          break;
        }
        case "reveal": {
          const html = await buildRevealHtml(
            doc.content,
            doc.title.replace(/\.md$/i, ""),
            mermaidTheme,
          );
          const path = await pickSavePath(`${slug}-slides.html`, "html", "HTML");
          if (!path) break;
          await backend.writeBinaryFile(path, stringToBase64(html));
          toast({ kind: "success", title: "Reveal.js slides exported" });
          await recordHistory(`${slug}-slides.html`);
          closeDialog();
          break;
        }
        case "diagrams-svg":
          await exportDiagrams("svg");
          break;
        case "diagrams-png":
          await exportDiagrams("png");
          break;
      }
    } catch (err) {
      toastError("Export failed", err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && closeDialog()}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content">
          <div
            className="flex items-center justify-between border-b px-4 py-3"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            <Dialog.Title className="text-sm font-semibold">
              Export “{doc.title}”
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="icon-btn" aria-label="Close export dialog">
                <X size={15} />
              </button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">
            Export the current document
          </Dialog.Description>

          <div className="flex flex-col gap-3 overflow-y-auto px-4 py-3">
            <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--text-secondary)" }}>
              Format
              <select
                className="input"
                value={format}
                onChange={(e) => setFormat(e.target.value as Format)}
              >
                {Object.entries(FORMAT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            {(format === "html" || format === "pdf" || format === "docx") && (
              <label className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                <input
                  type="checkbox"
                  checked={includeMermaid}
                  onChange={(e) => setIncludeMermaid(e.target.checked)}
                />
                Render Mermaid diagrams {format === "docx" ? "as embedded PNG" : "as SVG"}
              </label>
            )}

            {format === "pdf" && (
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                  Page size
                  <select
                    className="input"
                    value={pdfOptions.pageSize}
                    onChange={(e) =>
                      setPdfOptions({ ...pdfOptions, pageSize: e.target.value as PdfOptions["pageSize"] })
                    }
                  >
                    <option>A4</option>
                    <option>Letter</option>
                    <option>Legal</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                  Orientation
                  <select
                    className="input"
                    value={pdfOptions.orientation}
                    onChange={(e) =>
                      setPdfOptions({
                        ...pdfOptions,
                        orientation: e.target.value as PdfOptions["orientation"],
                      })
                    }
                  >
                    <option value="portrait">Portrait</option>
                    <option value="landscape">Landscape</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                  Margin (mm)
                  <input
                    className="input"
                    type="number"
                    min={5}
                    max={50}
                    value={pdfOptions.marginMm}
                    onChange={(e) =>
                      setPdfOptions({ ...pdfOptions, marginMm: Number(e.target.value) })
                    }
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                  Header text
                  <input
                    className="input"
                    value={pdfOptions.header}
                    onChange={(e) =>
                      setPdfOptions({ ...pdfOptions, header: e.target.value })
                    }
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                  Footer text
                  <input
                    className="input"
                    value={pdfOptions.footer}
                    onChange={(e) =>
                      setPdfOptions({ ...pdfOptions, footer: e.target.value })
                    }
                  />
                </label>
                <p className="col-span-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
                  The system print dialog opens next — choose “Save as PDF” /
                  “Microsoft Print to PDF” as the printer.
                </p>
              </div>
            )}

            {format === "docx" && (
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                DOCX export is built into MarkForge (no external tools
                required). Complex layouts are approximated.
              </p>
            )}

            {history.length > 0 && (
              <div>
                <h4 className="pb-1 text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                  Recent exports
                </h4>
                {history.slice(0, 5).map((h, i) => (
                  <div key={i} className="flex justify-between py-0.5 text-[11px]" style={{ color: "var(--text-secondary)" }}>
                    <span className="truncate">{h.filename}</span>
                    <span style={{ color: "var(--text-muted)" }}>
                      {new Date(h.exportedAt).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div
            className="flex justify-end gap-2 border-t px-4 py-3"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            <Dialog.Close asChild>
              <button className="btn">Cancel</button>
            </Dialog.Close>
            <button className="btn btn-primary" disabled={busy} onClick={() => void run()}>
              {busy ? "Exporting…" : "Export"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
