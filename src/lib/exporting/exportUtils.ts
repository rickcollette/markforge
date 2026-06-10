// Export pipeline helpers: HTML assembly, print-to-PDF, Reveal.js slides,
// plain text, and full-document rendering with inline Mermaid SVGs.
import previewThemesCss from "@/styles/preview-themes.css?raw";

import { renderMarkdown } from "../markdown/markdownParser";
import { renderMermaid, type MermaidTheme } from "../mermaid/mermaidConfig";
import { extractFrontmatter } from "../markdown/frontmatter";

export function slugifyTitle(input: string): string {
  const slug = input
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "document";
}

export function previewCss(dark: boolean): string {
  const colors = dark
    ? "body{background:#11141a;color:#e8ecf2;}"
    : "body{background:#ffffff;color:#1c2430;}";
  return `${colors}\nbody{margin:2rem auto;max-width:860px;padding:0 1.5rem;}\n${previewThemesCss}`;
}

/** Render markdown to a complete HTML body with Mermaid SVGs inlined. */
export async function renderFullHtml(
  markdown: string,
  options: {
    mermaidTheme: MermaidTheme;
    includeMermaid: boolean;
    previewTheme: string;
  },
): Promise<string> {
  const output = renderMarkdown(markdown);
  let html = output.html;
  if (options.includeMermaid) {
    for (let i = 0; i < output.mermaidSources.length; i++) {
      const source = output.mermaidSources[i];
      const result = await renderMermaid(source, options.mermaidTheme);
      const replacement = result.svg
        ? `<div class="mermaid-block">${result.svg}</div>`
        : `<pre class="code-block"><code>${escapeHtml(source)}</code></pre>`;
      html = replaceMermaidPlaceholder(html, i, replacement);
    }
  } else {
    for (let i = 0; i < output.mermaidSources.length; i++) {
      html = replaceMermaidPlaceholder(
        html,
        i,
        `<pre class="code-block"><code>${escapeHtml(output.mermaidSources[i])}</code></pre>`,
      );
    }
  }
  return `<div class="markdown-body preview-theme-${options.previewTheme}">${html}</div>`;
}

function replaceMermaidPlaceholder(
  html: string,
  index: number,
  replacement: string,
): string {
  const pattern = new RegExp(
    `<div class="mermaid-block" data-mermaid-index="${index}"[^>]*></div>`,
  );
  return html.replace(pattern, () => replacement);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ---------------------------------------------------------------------------
// PDF via print stylesheet + OS print dialog
// ---------------------------------------------------------------------------

export type PdfOptions = {
  pageSize: "Letter" | "A4" | "Legal";
  orientation: "portrait" | "landscape";
  marginMm: number;
  header: string;
  footer: string;
  pageNumbers: boolean;
};

export const DEFAULT_PDF_OPTIONS: PdfOptions = {
  pageSize: "A4",
  orientation: "portrait",
  marginMm: 18,
  header: "",
  footer: "",
  pageNumbers: true,
};

/** Render `bodyHtml` into a hidden print container and open the OS print
 * dialog (users pick "Save as PDF" / "Microsoft Print to PDF"). */
export function printHtml(bodyHtml: string, options: PdfOptions): void {
  document.getElementById("print-root")?.remove();
  document.getElementById("print-style")?.remove();

  const style = document.createElement("style");
  style.id = "print-style";
  style.textContent = `
@page {
  size: ${options.pageSize} ${options.orientation};
  margin: ${options.marginMm}mm;
}
@media print {
  #print-root .print-header,
  #print-root .print-footer {
    position: fixed;
    left: 0;
    right: 0;
    font-size: 10px;
    color: #555;
    text-align: center;
  }
  #print-root .print-header { top: 0; }
  #print-root .print-footer { bottom: 0; }
  #print-root pre, #print-root pre code {
    white-space: pre-wrap;
    word-break: break-word;
  }
  #print-root .markdown-body { color: #111; }
  #print-root a { color: #1a4fd6; }
}
${previewThemesCss}
`;

  const root = document.createElement("div");
  root.id = "print-root";
  const headerHtml = options.header
    ? `<div class="print-header">${escapeHtml(options.header)}</div>`
    : "";
  const footerHtml = options.footer
    ? `<div class="print-footer">${escapeHtml(options.footer)}</div>`
    : "";
  root.innerHTML = `${headerHtml}${footerHtml}${bodyHtml}`;

  document.head.appendChild(style);
  document.body.appendChild(root);

  // Give layout a tick before invoking the dialog.
  setTimeout(() => {
    window.print();
    setTimeout(() => {
      root.remove();
      style.remove();
    }, 500);
  }, 80);
}

// ---------------------------------------------------------------------------
// Reveal.js slides export (single offline HTML file)
// ---------------------------------------------------------------------------

/** Split markdown into slides on `---` lines (outside code fences) and
 * `<!-- slide -->` comments. */
export function splitSlides(markdown: string): string[] {
  const { body } = extractFrontmatter(markdown);
  const lines = body.split("\n");
  const slides: string[] = [];
  let current: string[] = [];
  let inFence = false;
  for (const line of lines) {
    if (/^\s*(`{3,}|~{3,})/.test(line)) inFence = !inFence;
    const isSeparator =
      !inFence && (/^---+\s*$/.test(line) || /^<!--\s*slide\s*-->\s*$/i.test(line));
    if (isSeparator) {
      if (current.join("").trim() !== "") slides.push(current.join("\n"));
      current = [];
    } else {
      current.push(line);
    }
  }
  if (current.join("").trim() !== "") slides.push(current.join("\n"));
  return slides.length > 0 ? slides : [body];
}

export async function buildRevealHtml(
  markdown: string,
  title: string,
  mermaidTheme: MermaidTheme,
): Promise<string> {
  // Import reveal assets lazily so they only load when exporting.
  // Relative paths: reveal.js's exports map does not expose dist/*.js,
  // and we need the UMD build as raw text to inline it.
  const [{ default: revealJs }, { default: revealCss }, { default: themeCss }] =
    await Promise.all([
      import("../../../node_modules/reveal.js/dist/reveal.js?raw"),
      import("../../../node_modules/reveal.js/dist/reveal.css?raw"),
      import("../../../node_modules/reveal.js/dist/theme/black.css?raw"),
    ]);

  const slides = splitSlides(markdown);
  const sections: string[] = [];
  for (const slide of slides) {
    const html = await renderFullHtml(slide, {
      mermaidTheme,
      includeMermaid: true,
      previewTheme: "presentation",
    });
    sections.push(`<section>${html}</section>`);
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>${revealCss}</style>
<style>${themeCss}</style>
<style>
.reveal .markdown-body { text-align: left; font-size: 0.62em; }
.reveal .markdown-body pre { font-size: 0.85em; }
.mermaid-block svg { max-width: 100%; height: auto; background: white; border-radius: 8px; padding: 8px; }
</style>
</head>
<body>
<div class="reveal"><div class="slides">
${sections.join("\n")}
</div></div>
<script>${revealJs}</script>
<script>Reveal.initialize({ hash: true });</script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Plain text export
// ---------------------------------------------------------------------------

export function markdownToPlainText(markdown: string): string {
  const { body } = extractFrontmatter(markdown);
  return body
    .replace(/```[\s\S]*?```/g, (block) =>
      block.split("\n").slice(1, -1).join("\n"),
    )
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/~~(.*?)~~/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^>\s?/gm, "")
    .replace(/^[-*+]\s+/gm, "• ")
    .replace(/\n{3,}/g, "\n\n");
}

export function stringToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
