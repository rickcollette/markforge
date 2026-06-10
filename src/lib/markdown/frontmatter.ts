import yaml from "js-yaml";

export type FrontmatterResult = {
  /** Raw YAML text between the --- fences (no fences). */
  raw: string | null;
  /** Parsed object, or null when absent/invalid. */
  data: Record<string, unknown> | null;
  /** Markdown body without the frontmatter block. */
  body: string;
  /** Number of lines occupied by the frontmatter block (incl. fences). */
  lineOffset: number;
};

const FM_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/;

export function extractFrontmatter(markdown: string): FrontmatterResult {
  const match = FM_PATTERN.exec(markdown);
  if (!match) {
    return { raw: null, data: null, body: markdown, lineOffset: 0 };
  }
  const raw = match[1];
  let data: Record<string, unknown> | null = null;
  try {
    const parsed = yaml.load(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      data = parsed as Record<string, unknown>;
    }
  } catch {
    data = null;
  }
  const lineOffset = match[0].split("\n").length - (match[2] ? 1 : 0);
  return {
    raw,
    data,
    body: markdown.slice(match[0].length),
    lineOffset,
  };
}

/** Replace (or insert) the frontmatter block, preserving the body. */
export function applyFrontmatter(
  markdown: string,
  data: Record<string, unknown>,
): string {
  const { body } = extractFrontmatter(markdown);
  const rawYaml = yaml.dump(data, { lineWidth: 100 }).trimEnd();
  if (Object.keys(data).length === 0) return body;
  return `---\n${rawYaml}\n---\n${body}`;
}

export function applyRawFrontmatter(markdown: string, rawYaml: string): string {
  const { body } = extractFrontmatter(markdown);
  const trimmed = rawYaml.trim();
  if (!trimmed) return body;
  return `---\n${trimmed}\n---\n${body}`;
}
