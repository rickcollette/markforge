import mermaid from "mermaid";
import DOMPurify from "dompurify";

import type { MermaidError, MermaidRenderResult } from "../types";
import { contentHash } from "./mermaidParser";

export type MermaidTheme = "default" | "dark" | "forest" | "neutral";

let currentTheme: MermaidTheme | null = null;

export function configureMermaid(theme: MermaidTheme) {
  if (theme === currentTheme) return;
  currentTheme = theme;
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme,
    htmlLabels: false,
    flowchart: { htmlLabels: false },
    fontFamily: "ui-sans-serif, system-ui, sans-serif",
    logLevel: 5,
  });
}

const renderCache = new Map<string, MermaidRenderResult>();
const MAX_CACHE = 300;

function parseMermaidError(err: unknown): MermaidError {
  const message =
    err instanceof Error ? err.message : typeof err === "string" ? err : String(err);
  // Mermaid error messages often include "... on line 4"
  const lineMatch = /line\s+(\d+)/i.exec(message);
  return {
    message: message.split("\n")[0].slice(0, 500),
    line: lineMatch ? Number(lineMatch[1]) : undefined,
    raw: message,
  };
}

export function sanitizeSvg(svg: string): string {
  return DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true, svgFilters: true },
    ADD_TAGS: ["foreignObject"],
    ADD_ATTR: ["dominant-baseline", "transform-origin"],
  });
}

/** Validate mermaid source without rendering. */
export async function validateMermaid(
  source: string,
): Promise<MermaidError | null> {
  try {
    await mermaid.parse(source);
    return null;
  } catch (err) {
    return parseMermaidError(err);
  }
}

/** Render mermaid source to sanitized SVG with content-hash caching. */
export async function renderMermaid(
  source: string,
  theme: MermaidTheme,
): Promise<MermaidRenderResult> {
  configureMermaid(theme);
  const key = `${theme}:${contentHash(source)}:${source.length}`;
  const cached = renderCache.get(key);
  if (cached) return cached;

  const id = `mf-diagram-${contentHash(source)}-${Math.floor(Math.random() * 1e6)}`;
  let result: MermaidRenderResult;
  try {
    const { svg } = await mermaid.render(id, source);
    result = {
      id,
      source,
      svg: sanitizeSvg(svg),
      error: null,
      renderedAt: new Date().toISOString(),
    };
  } catch (err) {
    // Mermaid leaves an orphaned error element behind on failure.
    document.getElementById(`d${id}`)?.remove();
    document.getElementById(id)?.remove();
    result = {
      id,
      source,
      svg: null,
      error: parseMermaidError(err),
      renderedAt: new Date().toISOString(),
    };
  }

  if (renderCache.size >= MAX_CACHE) {
    const first = renderCache.keys().next().value;
    if (first) renderCache.delete(first);
  }
  renderCache.set(key, result);
  return result;
}

export function clearMermaidCache() {
  renderCache.clear();
}
