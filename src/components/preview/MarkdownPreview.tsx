import { useEffect, useRef, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";

import { renderMarkdown } from "@/lib/markdown/markdownParser";
import { renderMermaid, type MermaidTheme } from "@/lib/mermaid/mermaidConfig";
import { contentHash } from "@/lib/mermaid/mermaidParser";
import { useSettingsStore } from "@/state/settingsStore";
import { useDocumentStore } from "@/state/documentStore";
import { useAppStore } from "@/state/appStore";

const LARGE_DOC_THRESHOLD = 300_000;
const HUGE_DOC_THRESHOLD = 2_000_000;

type Props = {
  markdown: string;
  docPath: string | null;
  onVisibleLineChange?: (line: number) => void;
  registerScrollToLine?: (fn: (line: number) => void) => void;
};

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

export default function MarkdownPreview({
  markdown,
  docPath,
  onVisibleLineChange,
  registerScrollToLine,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [html, setHtml] = useState("");
  const mermaidSourcesRef = useRef<string[]>([]);
  const [generation, setGeneration] = useState(0);
  const [paused, setPaused] = useState(false);
  const suppressScroll = useRef(0);
  const previewTheme = useSettingsStore((s) => s.settings.preview.theme);
  const mermaidTheme = useSettingsStore(
    (s) => s.settings.mermaid.theme,
  ) as MermaidTheme;

  const huge = markdown.length > HUGE_DOC_THRESHOLD;

  // Debounced markdown rendering.
  useEffect(() => {
    if (paused) return;
    if (huge) {
      setPaused(true);
      return;
    }
    const delay = markdown.length > LARGE_DOC_THRESHOLD ? 600 : 150;
    const timer = setTimeout(() => {
      const output = renderMarkdown(markdown);
      mermaidSourcesRef.current = output.mermaidSources;
      setHtml(output.html);
      setGeneration((g) => g + 1);
    }, delay);
    return () => clearTimeout(timer);
  }, [markdown, paused, huge]);

  // Post-process rendered HTML: mermaid diagrams, images, links, tasks.
  // Processing is idempotent (each block carries the key of the output it
  // displays) and is re-triggered by a MutationObserver, so it self-heals
  // whenever React re-commits the preview HTML and wipes rendered diagrams.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let disposed = false;

    const processContainer = () => {
      // 1. Mermaid placeholders -> rendered diagrams (independently). The
      // source is embedded in the element, so any pass can render any block.
      // Each element tracks the content+theme it (will) display; the resolved
      // promise applies as long as the element still wants that output. No
      // effect-lifetime flag is involved: renders are idempotent and cheap to
      // re-apply, while tying them to effect cleanup loses results whenever
      // a no-op generation tick disposes the effect mid-render.
      const blocks = container.querySelectorAll<HTMLElement>(".mermaid-block");
      blocks.forEach((el) => {
        const idx = Number(el.dataset.mermaidIndex ?? "-1");
        const source =
          el.dataset.mermaidSrc !== undefined
            ? decodeURIComponent(el.dataset.mermaidSrc)
            : mermaidSourcesRef.current[idx];
        if (source === undefined) return;
        const desiredKey = `${mermaidTheme}:${contentHash(source)}:${source.length}`;
        if (el.dataset.mermaidKey === desiredKey) return;
        el.dataset.mermaidKey = desiredKey;
        el.innerHTML = `<div class="mermaid-loading">Rendering diagram…</div>`;
        const stillWanted = () =>
          el.isConnected && el.dataset.mermaidKey === desiredKey;
        renderMermaid(source, mermaidTheme)
          .then((result) => {
            if (!stillWanted()) return;
            if (result.svg) {
              el.innerHTML = result.svg;
            } else {
              el.innerHTML = "";
              const card = document.createElement("div");
              card.className = "mermaid-error";
              const title = document.createElement("strong");
              title.textContent = `Mermaid error${result.error?.line ? ` (line ${result.error.line})` : ""}: `;
              const msg = document.createElement("span");
              msg.textContent = result.error?.message ?? "Unknown error";
              const pre = document.createElement("pre");
              pre.textContent = source;
              card.append(title, msg, pre);
              el.appendChild(card);
            }
          })
          .catch(() => {
            if (stillWanted()) {
              el.innerHTML = `<div class="mermaid-error">Mermaid renderer failed.</div>`;
            }
          });
      });

      // 2. Relative image paths via the Tauri asset protocol.
      if (docPath) {
        const dir = dirOf(docPath);
        container.querySelectorAll("img").forEach((img) => {
          const src = img.getAttribute("src") ?? "";
          if (
            src &&
            !/^(https?:|data:|blob:|asset:|http:\/\/asset\.)/i.test(src)
          ) {
            img.src = convertFileSrc(
              resolveRelative(dir, decodeURIComponent(src)),
            );
          }
          img.loading = "lazy";
        });
      }

      // 3. Task checkboxes are read-only in preview.
      container
        .querySelectorAll<HTMLInputElement>("input[type=checkbox]")
        .forEach((cb) => {
          cb.disabled = true;
        });
    };

    processContainer();

    // Re-process when React replaces the preview HTML. Our own mutations
    // never re-trigger work because processed blocks carry their output key.
    const observer = new MutationObserver((mutations) => {
      if (disposed) return;
      const replaced = mutations.some((m) =>
        Array.from(m.addedNodes).some(
          (n) =>
            n.nodeType === 1 &&
            ((n as Element).classList.contains("mermaid-block") ||
              (n as Element).querySelector?.(".mermaid-block") !== null),
        ),
      );
      if (replaced) processContainer();
    });
    observer.observe(container, { childList: true, subtree: true });

    return () => {
      disposed = true;
      observer.disconnect();
    };
  }, [generation, html, mermaidTheme, docPath]);

  // Safe link handling.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href") ?? "";
      e.preventDefault();
      if (/^(https?:|mailto:)/i.test(href)) {
        void openUrl(href).catch(() =>
          useAppStore.getState().toast({
            kind: "error",
            title: "Could not open external link",
          }),
        );
      } else if (href.startsWith("#")) {
        const target = container.querySelector(
          `#${CSS.escape(decodeURIComponent(href.slice(1)))}`,
        );
        target?.scrollIntoView({ behavior: "smooth", block: "start" });
      } else if (href && docPath && /\.(md|markdown|mmd)$/i.test(href)) {
        const full = resolveRelative(dirOf(docPath), decodeURIComponent(href));
        void useDocumentStore.getState().openPath(full, { allow: true });
      }
    };
    container.addEventListener("click", onClick);
    return () => container.removeEventListener("click", onClick);
  }, [docPath]);

  // Scroll sync.
  useEffect(() => {
    registerScrollToLine?.((line) => {
      const container = containerRef.current;
      if (!container) return;
      const elements = container.querySelectorAll<HTMLElement>("[data-line]");
      let best: HTMLElement | null = null;
      for (const el of elements) {
        const elLine = Number(el.dataset.line);
        if (elLine <= line) best = el;
        else break;
      }
      if (best) {
        suppressScroll.current = Date.now() + 250;
        container.scrollTo({
          top: best.offsetTop - 16,
          behavior: "auto",
        });
      }
    });
  }, [registerScrollToLine, generation]);

  const handleScroll = () => {
    if (Date.now() < suppressScroll.current) return;
    const container = containerRef.current;
    if (!container || !onVisibleLineChange) return;
    const top = container.scrollTop;
    const elements = container.querySelectorAll<HTMLElement>("[data-line]");
    for (const el of elements) {
      if (el.offsetTop >= top - 8) {
        onVisibleLineChange(Number(el.dataset.line));
        return;
      }
    }
  };

  if (paused) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <p style={{ color: "var(--text-secondary)" }}>
          This document is very large ({Math.round(markdown.length / 1024)} KB).
          Live preview is paused to keep editing fast.
        </p>
        <button
          className="btn btn-primary"
          onClick={() => {
            setPaused(false);
          }}
        >
          Render preview anyway
        </button>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="h-full overflow-y-auto px-8 py-6"
      style={{ background: "var(--bg-app)" }}
    >
      <div
        className={`markdown-body preview-theme-${previewTheme}`}
        // Rendered HTML is sanitized with DOMPurify in renderMarkdown.
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
