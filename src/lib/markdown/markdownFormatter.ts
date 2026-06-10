// Pure text-transform helpers behind the Format menu.

/** Measure a string's display width (CJK-naive, good enough for tables). */
function cellWidth(text: string): number {
  return [...text].length;
}

function isTableDivider(line: string): boolean {
  return /^\s*\|?[\s:|-]+\|?\s*$/.test(line) && line.includes("-");
}

function isTableRow(line: string): boolean {
  return line.trimStart().startsWith("|") || line.includes(" | ");
}

function splitRow(line: string): string[] {
  let trimmed = line.trim();
  if (trimmed.startsWith("|")) trimmed = trimmed.slice(1);
  if (trimmed.endsWith("|")) trimmed = trimmed.slice(0, -1);
  // Split on unescaped pipes.
  const cells: string[] = [];
  let current = "";
  for (let i = 0; i < trimmed.length; i++) {
    const c = trimmed[i];
    if (c === "\\" && trimmed[i + 1] === "|") {
      current += "\\|";
      i++;
    } else if (c === "|") {
      cells.push(current.trim());
      current = "";
    } else {
      current += c;
    }
  }
  cells.push(current.trim());
  return cells;
}

type Alignment = "left" | "center" | "right" | "none";

function parseAlignment(divider: string): Alignment {
  const d = divider.trim();
  const left = d.startsWith(":");
  const right = d.endsWith(":");
  if (left && right) return "center";
  if (right) return "right";
  if (left) return "left";
  return "none";
}

function dividerFor(alignment: Alignment, width: number): string {
  const dashes = Math.max(3, width);
  switch (alignment) {
    case "center":
      return `:${"-".repeat(dashes - 2)}:`;
    case "right":
      return `${"-".repeat(dashes - 1)}:`;
    case "left":
      return `:${"-".repeat(dashes - 1)}`;
    default:
      return "-".repeat(dashes);
  }
}

/** Format a markdown table block (array of lines) to aligned columns. */
export function formatTableLines(lines: string[]): string[] {
  if (lines.length < 2 || !isTableDivider(lines[1])) return lines;
  const rows = lines.map(splitRow);
  const alignments = rows[1].map(parseAlignment);
  const columnCount = Math.max(...rows.map((r) => r.length));

  const widths: number[] = [];
  for (let c = 0; c < columnCount; c++) {
    let w = 3;
    rows.forEach((row, idx) => {
      if (idx === 1) return;
      w = Math.max(w, cellWidth(row[c] ?? ""));
    });
    widths.push(w);
  }

  return rows.map((row, idx) => {
    if (idx === 1) {
      const cells = widths.map((w, c) =>
        dividerFor(alignments[c] ?? "none", w),
      );
      return `| ${cells.join(" | ")} |`;
    }
    const cells = widths.map((w, c) => {
      const text = row[c] ?? "";
      const pad = w - cellWidth(text);
      const align = alignments[c] ?? "none";
      if (align === "right") return " ".repeat(pad) + text;
      if (align === "center") {
        const lpad = Math.floor(pad / 2);
        return " ".repeat(lpad) + text + " ".repeat(pad - lpad);
      }
      return text + " ".repeat(pad);
    });
    return `| ${cells.join(" | ")} |`;
  });
}

/** Format every markdown table in the document. */
export function formatAllTables(markdown: string): string {
  const lines = markdown.split("\n");
  const result: string[] = [];
  let i = 0;
  let inFence = false;
  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*(`{3,}|~{3,})/.test(line)) inFence = !inFence;
    if (
      !inFence &&
      isTableRow(line) &&
      i + 1 < lines.length &&
      isTableDivider(lines[i + 1])
    ) {
      const block: string[] = [];
      while (i < lines.length && lines[i].trim() !== "" && isTableRow(lines[i])) {
        block.push(lines[i]);
        i++;
      }
      result.push(...formatTableLines(block));
    } else {
      result.push(line);
      i++;
    }
  }
  return result.join("\n");
}

export function trimTrailingWhitespace(markdown: string): string {
  return markdown
    .split("\n")
    .map((l) => l.replace(/[ \t]+$/, ""))
    .join("\n");
}

export function convertTabsToSpaces(text: string, tabSize = 2): string {
  return text.replace(/\t/g, " ".repeat(tabSize));
}

export function convertSpacesToTabs(text: string, tabSize = 2): string {
  return text
    .split("\n")
    .map((line) => {
      const match = /^( +)/.exec(line);
      if (!match) return line;
      const spaces = match[1].length;
      const tabs = Math.floor(spaces / tabSize);
      return "\t".repeat(tabs) + " ".repeat(spaces % tabSize) + line.slice(spaces);
    })
    .join("\n");
}

export function sortLines(text: string): string {
  const hadTrailingNewline = text.endsWith("\n");
  const lines = text.replace(/\n$/, "").split("\n");
  lines.sort((a, b) => a.localeCompare(b));
  return lines.join("\n") + (hadTrailingNewline ? "\n" : "");
}

/** Renumber all ordered lists to sequential numbering. */
export function renumberOrderedLists(markdown: string): string {
  const lines = markdown.split("\n");
  const counters = new Map<number, number>();
  let inFence = false;
  const result = lines.map((line) => {
    if (/^\s*(`{3,}|~{3,})/.test(line)) {
      inFence = !inFence;
      return line;
    }
    if (inFence) return line;
    const match = /^(\s*)(\d+)([.)])(\s+)(.*)$/.exec(line);
    if (!match) {
      if (line.trim() === "" || !/^\s/.test(line)) counters.clear();
      return line;
    }
    const indent = match[1].length;
    // Reset deeper counters when we return to a shallower level.
    for (const key of [...counters.keys()]) {
      if (key > indent) counters.delete(key);
    }
    const next = (counters.get(indent) ?? 0) + 1;
    counters.set(indent, next);
    return `${match[1]}${next}${match[3]}${match[4]}${match[5]}`;
  });
  return result.join("\n");
}

/** Fix skipped heading levels (e.g. H1 -> H3 becomes H1 -> H2). */
export function normalizeHeadings(markdown: string): string {
  const lines = markdown.split("\n");
  let inFence = false;
  let lastLevel = 0;
  const mapping = new Map<number, number>();
  return lines
    .map((line) => {
      if (/^\s*(`{3,}|~{3,})/.test(line)) {
        inFence = !inFence;
        return line;
      }
      if (inFence) return line;
      const match = /^(#{1,6})(\s+.*)$/.exec(line);
      if (!match) return line;
      const level = match[1].length;
      let newLevel: number;
      if (mapping.has(level)) {
        newLevel = mapping.get(level)!;
      } else {
        newLevel = Math.min(level, lastLevel + 1);
        mapping.set(level, newLevel);
      }
      // Drop deeper mappings when moving back up.
      for (const key of [...mapping.keys()]) {
        if (key > level) mapping.delete(key);
      }
      lastLevel = newLevel;
      return "#".repeat(newLevel) + match[2];
    })
    .join("\n");
}

/** Convert CSV/TSV-ish selected lines to a markdown table. */
export function convertToTable(selection: string): string {
  const lines = selection.split("\n").filter((l) => l.trim() !== "");
  if (lines.length === 0) return selection;
  const delimiter = lines[0].includes("\t")
    ? "\t"
    : lines[0].includes(",")
      ? ","
      : /\s{2,}/;
  const rows = lines.map((l) =>
    l.split(delimiter as never).map((c: string) => c.trim()),
  );
  const cols = Math.max(...rows.map((r) => r.length));
  const header = rows[0];
  const out: string[] = [];
  out.push(`| ${Array.from({ length: cols }, (_, i) => header[i] ?? "").join(" | ")} |`);
  out.push(`|${Array.from({ length: cols }, () => "---").join("|")}|`);
  for (const row of rows.slice(1)) {
    out.push(
      `| ${Array.from({ length: cols }, (_, i) => row[i] ?? "").join(" | ")} |`,
    );
  }
  return formatTableLines(out).join("\n");
}

export function convertToTaskList(selection: string): string {
  return selection
    .split("\n")
    .map((line) => {
      if (line.trim() === "") return line;
      const stripped = line.replace(/^(\s*)([-*+]\s+|\d+[.)]\s+)?/, "$1");
      const indent = /^(\s*)/.exec(line)?.[1] ?? "";
      if (/^\s*- \[[ xX]\]/.test(line)) return line;
      return `${indent}- [ ] ${stripped.trim()}`;
    })
    .join("\n");
}

/** Hard-wrap paragraph text at a column, preserving list markers. */
export function wrapParagraph(text: string, column = 80): string {
  return text
    .split(/\n{2,}/)
    .map((para) => {
      const oneline = para.replace(/\s*\n\s*/g, " ").trim();
      if (oneline === "") return "";
      const words = oneline.split(" ");
      const lines: string[] = [];
      let current = "";
      for (const word of words) {
        if (current && (current + " " + word).length > column) {
          lines.push(current);
          current = word;
        } else {
          current = current ? `${current} ${word}` : word;
        }
      }
      if (current) lines.push(current);
      return lines.join("\n");
    })
    .join("\n\n");
}

export function unwrapParagraph(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((para) => para.replace(/\s*\n\s*/g, " ").trim())
    .join("\n\n");
}

/** Dedent the body of mermaid fenced blocks so diagrams parse reliably. */
export function fixMermaidIndentation(markdown: string): string {
  const lines = markdown.split("\n");
  const result = [...lines];
  let inMermaid = false;
  let fenceIndent = 0;
  for (let i = 0; i < lines.length; i++) {
    const open = /^(\s*)(`{3,})\s*(mermaid|mmd|diagram|mermaid-\w+)\s*$/.exec(
      lines[i],
    );
    if (!inMermaid && open) {
      inMermaid = true;
      fenceIndent = open[1].length;
      if (fenceIndent > 0) result[i] = lines[i].trimStart();
      continue;
    }
    if (inMermaid) {
      if (/^\s*`{3,}\s*$/.test(lines[i])) {
        inMermaid = false;
        result[i] = lines[i].trimStart();
        continue;
      }
      if (fenceIndent > 0) {
        result[i] = lines[i].startsWith(" ".repeat(fenceIndent))
          ? lines[i].slice(fenceIndent)
          : lines[i];
      }
    }
  }
  return result.join("\n");
}

/** Clean markdown: trailing whitespace, excess blank lines, table formatting. */
export function cleanMarkdown(markdown: string): string {
  let text = trimTrailingWhitespace(markdown);
  text = text.replace(/\n{4,}/g, "\n\n\n");
  text = formatAllTables(text);
  if (!text.endsWith("\n")) text += "\n";
  return text;
}

export const DEFAULT_TABLE = `| Column 1 | Column 2 | Column 3 |
| --- | --- | --- |
| Value 1 | Value 2 | Value 3 |`;

export function calloutTemplate(type: string): string {
  return `> [!${type.toUpperCase()}]\n> Write your note here.`;
}
