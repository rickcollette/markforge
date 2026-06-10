// Markdown linting (SPEC.md section 24). Pure text analysis; mermaid
// syntax findings are merged in asynchronously by the caller.
import type { LintFinding } from "../types";
import { extractFrontmatter } from "./frontmatter";
import { extractHeadings } from "./markdownParser";
import { slugify } from "./slugify";

let findingCounter = 0;

function finding(
  severity: LintFinding["severity"],
  message: string,
  line: number,
  source: LintFinding["source"] = "markdown",
  column?: number,
): LintFinding {
  return {
    id: `lint-${++findingCounter}`,
    severity,
    message,
    line,
    column,
    source,
  };
}

export function lintMarkdown(markdown: string): LintFinding[] {
  const findings: LintFinding[] = [];
  const { body, lineOffset } = extractFrontmatter(markdown);
  const lines = body.split("\n");
  const headings = extractHeadings(markdown);

  // --- Headings ---
  const h1s = headings.filter((h) => h.level === 1);
  if (h1s.length === 0 && body.trim() !== "") {
    findings.push(finding("info", "Document has no top-level heading (H1)", 1));
  }
  for (const extra of h1s.slice(1)) {
    findings.push(
      finding("warning", "Multiple H1 headings in document", extra.line),
    );
  }
  let prevLevel = 0;
  for (const h of headings) {
    if (prevLevel > 0 && h.level > prevLevel + 1) {
      findings.push(
        finding(
          "warning",
          `Skipped heading level: H${prevLevel} followed by H${h.level}`,
          h.line,
        ),
      );
    }
    if (h.text.trim() === "") {
      findings.push(finding("warning", "Empty heading", h.line));
    }
    prevLevel = h.level;
  }

  // --- Line-based checks ---
  let inFence = false;
  let fenceLine = 0;
  let fenceMarker = "";
  let listMarker: string | null = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNo = i + 1 + lineOffset;

    const fence = /^\s*(`{3,}|~{3,})/.exec(line);
    if (fence) {
      if (!inFence) {
        inFence = true;
        fenceLine = lineNo;
        fenceMarker = fence[1];
      } else if (line.trim().startsWith(fenceMarker[0].repeat(3))) {
        inFence = false;
      }
      continue;
    }
    if (inFence) continue;

    if (/[ \t]+$/.test(line) && line.trim() !== "") {
      findings.push(finding("info", "Trailing whitespace", lineNo));
    }

    const list = /^\s*([-*+])\s+\S/.exec(line);
    if (list) {
      if (listMarker && list[1] !== listMarker) {
        findings.push(
          finding(
            "info",
            `Inconsistent list marker "${list[1]}" (document uses "${listMarker}")`,
            lineNo,
          ),
        );
      } else if (!listMarker) {
        listMarker = list[1];
      }
    }

    // Empty links [text]() or [](url)
    for (const match of line.matchAll(/\[([^\]]*)\]\(([^)]*)\)/g)) {
      const isImage = line[match.index! - 1] === "!";
      if (match[2].trim() === "") {
        findings.push(
          finding(
            "warning",
            isImage ? "Image with empty source" : "Link with empty URL",
            lineNo,
            "links",
            match.index! + 1,
          ),
        );
      } else if (!isImage && match[1].trim() === "") {
        findings.push(
          finding("info", "Link with empty text", lineNo, "links", match.index! + 1),
        );
      }
    }
  }

  if (inFence) {
    findings.push(
      finding("error", "Unclosed fenced code block", fenceLine),
    );
  }

  // --- Broken internal heading links ---
  const slugs = new Set(headings.map((h) => h.slug));
  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1 + lineOffset;
    for (const match of lines[i].matchAll(/\[[^\]]*\]\(#([^)]+)\)/g)) {
      const target = decodeURIComponent(match[1]);
      if (!slugs.has(target) && !slugs.has(slugify(target))) {
        findings.push(
          finding(
            "warning",
            `Broken internal link: #${target}`,
            lineNo,
            "links",
            match.index! + 1,
          ),
        );
      }
    }
  }

  // --- Tables with inconsistent column counts ---
  for (let i = 0; i < lines.length - 1; i++) {
    const isDivider = /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1]) &&
      lines[i + 1].includes("-");
    if (lines[i].trimStart().startsWith("|") && isDivider) {
      const headerCols = countTableColumns(lines[i]);
      let j = i + 2;
      while (j < lines.length && lines[j].trimStart().startsWith("|")) {
        const cols = countTableColumns(lines[j]);
        if (cols !== headerCols) {
          findings.push(
            finding(
              "warning",
              `Table row has ${cols} column(s); header has ${headerCols}`,
              j + 1 + lineOffset,
            ),
          );
        }
        j++;
      }
      i = j;
    }
  }

  return findings;
}

function countTableColumns(line: string): number {
  let trimmed = line.trim();
  if (trimmed.startsWith("|")) trimmed = trimmed.slice(1);
  if (trimmed.endsWith("|")) trimmed = trimmed.slice(0, -1);
  let count = 1;
  for (let i = 0; i < trimmed.length; i++) {
    if (trimmed[i] === "|" && trimmed[i - 1] !== "\\") count++;
  }
  return count;
}

/** Extract all link/image references for the link checker panel. */
export type DocumentLink = {
  kind: "heading" | "file" | "image" | "external" | "mailto";
  text: string;
  target: string;
  line: number;
};

export function extractLinks(markdown: string): DocumentLink[] {
  const { body, lineOffset } = extractFrontmatter(markdown);
  const lines = body.split("\n");
  const links: DocumentLink[] = [];
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*(`{3,}|~{3,})/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    for (const match of line.matchAll(/(!?)\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
      const isImage = match[1] === "!";
      const target = match[3];
      let kind: DocumentLink["kind"];
      if (isImage) kind = "image";
      else if (target.startsWith("#")) kind = "heading";
      else if (/^https?:\/\//i.test(target)) kind = "external";
      else if (target.startsWith("mailto:")) kind = "mailto";
      else kind = "file";
      links.push({
        kind,
        text: match[2],
        target,
        line: i + 1 + lineOffset,
      });
    }
  }
  return links;
}
