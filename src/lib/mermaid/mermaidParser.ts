import type { MermaidBlock } from "../types";

export const MERMAID_ALIASES = [
  "mermaid",
  "mmd",
  "diagram",
  "mermaid-flowchart",
  "mermaid-sequence",
];

export function isMermaidLanguage(lang: string | null | undefined): boolean {
  if (!lang) return false;
  const normalized = lang.trim().toLowerCase();
  return (
    MERMAID_ALIASES.includes(normalized) || normalized.startsWith("mermaid-")
  );
}

const TYPE_PATTERNS: [RegExp, string][] = [
  [/^\s*(flowchart|graph)\b/m, "flowchart"],
  [/^\s*sequenceDiagram\b/m, "sequence"],
  [/^\s*classDiagram\b/m, "class"],
  [/^\s*stateDiagram(-v2)?\b/m, "state"],
  [/^\s*erDiagram\b/m, "er"],
  [/^\s*gantt\b/m, "gantt"],
  [/^\s*pie\b/m, "pie"],
  [/^\s*mindmap\b/m, "mindmap"],
  [/^\s*timeline\b/m, "timeline"],
  [/^\s*journey\b/m, "journey"],
  [/^\s*gitGraph\b/m, "gitgraph"],
  [/^\s*quadrantChart\b/m, "quadrant"],
];

export function detectDiagramType(source: string): string {
  // Skip init directives and comments when sniffing the type.
  const cleaned = source
    .split("\n")
    .filter((l) => !l.trim().startsWith("%%"))
    .join("\n");
  for (const [pattern, type] of TYPE_PATTERNS) {
    if (pattern.test(cleaned)) return type;
  }
  return "diagram";
}

/** Extract fenced mermaid blocks from markdown text (line numbers 1-based). */
export function extractMermaidBlocks(markdown: string): MermaidBlock[] {
  const lines = markdown.split("\n");
  const blocks: MermaidBlock[] = [];
  let inFence = false;
  let fenceMarker = "";
  let fenceLang = "";
  let fenceStart = 0;
  let buffer: string[] = [];
  let index = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const open = /^(\s*)(`{3,}|~{3,})\s*(\S*)\s*$/.exec(line);
    if (!inFence && open && open[3]) {
      inFence = true;
      fenceMarker = open[2];
      fenceLang = open[3].toLowerCase();
      fenceStart = i + 1;
      buffer = [];
      continue;
    }
    if (inFence) {
      const close = new RegExp(`^\\s*${fenceMarker[0]}{${fenceMarker.length},}\\s*$`);
      if (close.test(line)) {
        if (isMermaidLanguage(fenceLang)) {
          const source = buffer.join("\n");
          blocks.push({
            index,
            source,
            language: fenceLang,
            startLine: fenceStart,
            endLine: i + 1,
            type: detectDiagramType(source),
          });
          index += 1;
        }
        inFence = false;
        fenceLang = "";
        continue;
      }
      buffer.push(line);
    }
  }
  return blocks;
}

/** Simple stable content hash (djb2) for diagram caching and IDs. */
export function contentHash(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}

/** Replace the source of the index-th mermaid block in a markdown document. */
export function replaceMermaidBlock(
  markdown: string,
  blockIndex: number,
  newSource: string,
): string | null {
  const blocks = extractMermaidBlocks(markdown);
  const block = blocks[blockIndex];
  if (!block) return null;
  const lines = markdown.split("\n");
  const before = lines.slice(0, block.startLine);
  const after = lines.slice(block.endLine - 1);
  return [...before, ...newSource.replace(/\n$/, "").split("\n"), ...after].join(
    "\n",
  );
}
