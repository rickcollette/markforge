import MarkdownIt from "markdown-it";
import anchor from "markdown-it-anchor";
import taskLists from "markdown-it-task-lists";
import footnote from "markdown-it-footnote";
import DOMPurify from "dompurify";
import hljs from "highlight.js";

import { extractFrontmatter } from "./frontmatter";
import { slugify } from "./slugify";
import { isMermaidLanguage } from "../mermaid/mermaidParser";

export type Heading = {
  level: number;
  text: string;
  line: number;
  slug: string;
};

export type RenderOutput = {
  /** Sanitized HTML, with mermaid blocks left as placeholder divs. */
  html: string;
  /** Mermaid sources in document order (placeholder index matches). */
  mermaidSources: string[];
  headings: Heading[];
  frontmatterRaw: string | null;
  frontmatterData: Record<string, unknown> | null;
};

const CALLOUT_TYPES = ["NOTE", "TIP", "IMPORTANT", "WARNING", "CAUTION"];

function createParser(): MarkdownIt {
  const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: false,
    highlight: (code, lang) => {
      if (lang && hljs.getLanguage(lang)) {
        try {
          return hljs.highlight(code, { language: lang }).value;
        } catch {
          /* fall through to escaped */
        }
      }
      return "";
    },
  });

  md.use(anchor, {
    slugify,
    tabIndex: false,
  });
  md.use(taskLists, { enabled: false, label: true });
  md.use(footnote);

  // Source-line mapping for scroll sync: add data-line to block tokens.
  const lineRule = (
    tokens: { map: [number, number] | null; attrSet: (k: string, v: string) => void }[],
    idx: number,
  ) => {
    const token = tokens[idx];
    if (token.map) {
      token.attrSet("data-line", String(token.map[0] + 1));
    }
  };
  for (const rule of [
    "paragraph_open",
    "heading_open",
    "blockquote_open",
    "bullet_list_open",
    "ordered_list_open",
    "table_open",
    "hr",
  ]) {
    const original = md.renderer.rules[rule];
    md.renderer.rules[rule] = (tokens, idx, options, env, self) => {
      lineRule(tokens as never, idx);
      return original
        ? original(tokens, idx, options, env, self)
        : self.renderToken(tokens, idx, options);
    };
  }

  // GitHub-style callouts: > [!NOTE] ...
  md.core.ruler.push("markforge_callouts", (state) => {
    const tokens = state.tokens;
    for (let i = 0; i < tokens.length - 2; i++) {
      if (
        tokens[i].type === "blockquote_open" &&
        tokens[i + 1].type === "paragraph_open" &&
        tokens[i + 2].type === "inline"
      ) {
        const inline = tokens[i + 2];
        const match = /^\[!(\w+)\]\s*/.exec(inline.content);
        if (match && CALLOUT_TYPES.includes(match[1].toUpperCase())) {
          const type = match[1].toLowerCase();
          tokens[i].attrJoin("class", `callout callout-${type}`);
          tokens[i].attrSet("data-callout", type);
          inline.content = inline.content.slice(match[0].length);
          if (inline.children && inline.children.length > 0) {
            const first = inline.children.find((c) => c.type === "text");
            if (first) {
              first.content = first.content.replace(/^\[!(\w+)\]\s*/, "");
            }
          }
        }
      }
    }
  });

  // Fenced code: mermaid placeholders + highlighted code blocks.
  md.renderer.rules.fence = (tokens, idx, options, env) => {
    const token = tokens[idx];
    const lang = (token.info || "").trim().split(/\s+/)[0];
    const line = token.map ? token.map[0] + 1 : 0;

    if (isMermaidLanguage(lang)) {
      const sources: string[] = (env as { mermaidSources?: string[] })
        .mermaidSources ?? [];
      const index = sources.length;
      sources.push(token.content);
      (env as { mermaidSources?: string[] }).mermaidSources = sources;
      // The source is embedded in the placeholder so post-processing never
      // depends on out-of-band state (a React ref can lag behind what is
      // actually committed to the DOM).
      const encoded = encodeURIComponent(token.content);
      return `<div class="mermaid-block" data-mermaid-index="${index}" data-mermaid-src="${encoded}" data-line="${line}"></div>\n`;
    }

    let highlighted = "";
    if (options.highlight) {
      highlighted = options.highlight(token.content, lang, "") || "";
    }
    const escaped = highlighted || md.utils.escapeHtml(token.content);
    const langClass = lang ? ` class="language-${md.utils.escapeHtml(lang)}"` : "";
    return `<pre class="code-block" data-line="${line}" data-lang="${md.utils.escapeHtml(lang)}"><code${langClass}>${escaped}</code></pre>\n`;
  };

  // [[toc]] support.
  md.core.ruler.push("markforge_toc", (state) => {
    for (const token of state.tokens) {
      if (
        token.type === "inline" &&
        /^\[\[toc\]\]$/i.test(token.content.trim())
      ) {
        token.content = "";
        if (token.children) token.children = [];
        (token as { markforgeToc?: boolean }).markforgeToc = true;
      }
    }
  });
  const origParagraph = md.renderer.rules.paragraph_open;
  md.renderer.rules.paragraph_open = (tokens, idx, options, env, self) => {
    const inline = tokens[idx + 1];
    if (inline && (inline as { markforgeToc?: boolean }).markforgeToc) {
      const headings = (env as { headings?: Heading[] }).headings ?? [];
      return `<nav class="toc">${renderTocHtml(headings)}` + "<p hidden>";
    }
    return origParagraph
      ? origParagraph(tokens, idx, options, env, self)
      : self.renderToken(tokens, idx, options);
  };
  const origParagraphClose = md.renderer.rules.paragraph_close;
  md.renderer.rules.paragraph_close = (tokens, idx, options, env, self) => {
    const inline = tokens[idx - 1];
    if (inline && (inline as { markforgeToc?: boolean }).markforgeToc) {
      return "</p></nav>";
    }
    return origParagraphClose
      ? origParagraphClose(tokens, idx, options, env, self)
      : self.renderToken(tokens, idx, options);
  };

  return md;
}

function renderTocHtml(headings: Heading[]): string {
  if (headings.length === 0) return "";
  let html = "";
  let level = 0;
  for (const h of headings) {
    while (level < h.level) {
      html += "<ul>";
      level++;
    }
    while (level > h.level) {
      html += "</ul>";
      level--;
    }
    html += `<li><a href="#${h.slug}">${escapeText(h.text)}</a></li>`;
  }
  while (level > 0) {
    html += "</ul>";
    level--;
  }
  return html;
}

function escapeText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function extractHeadings(markdown: string): Heading[] {
  const { body, lineOffset } = extractFrontmatter(markdown);
  const lines = body.split("\n");
  const headings: Heading[] = [];
  const slugCounts = new Map<string, number>();
  let inFence = false;
  let fenceMarker = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = /^(\s*)(`{3,}|~{3,})/.exec(line);
    if (fence) {
      if (!inFence) {
        inFence = true;
        fenceMarker = fence[2];
      } else if (line.trim().startsWith(fenceMarker[0].repeat(3))) {
        inFence = false;
      }
      continue;
    }
    if (inFence) continue;
    const match = /^(#{1,6})\s+(.*?)(\s+#+\s*)?$/.exec(line);
    if (match) {
      const text = match[2].trim();
      let slug = slugify(text);
      const count = slugCounts.get(slug) ?? 0;
      slugCounts.set(slug, count + 1);
      if (count > 0) slug = `${slug}-${count}`;
      headings.push({
        level: match[1].length,
        text,
        line: i + 1 + lineOffset,
        slug,
      });
    }
  }
  return headings;
}

const SANITIZE_CONFIG = {
  ADD_TAGS: ["nav"],
  ADD_ATTR: [
    "data-line",
    "data-mermaid-index",
    "data-mermaid-src",
    "data-callout",
    "data-lang",
    "data-footnote-ref",
    "data-footnote-backref",
  ],
  FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form"],
  FORBID_ATTR: ["onerror", "onload", "onclick"],
  ALLOW_UNKNOWN_PROTOCOLS: false,
};

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, SANITIZE_CONFIG);
}

const parser = createParser();

export function renderMarkdown(
  markdown: string,
  options?: { sanitize?: boolean },
): RenderOutput {
  const { body, raw, data, lineOffset } = extractFrontmatter(markdown);
  const headings = extractHeadings(markdown);
  const env: { mermaidSources?: string[]; headings?: Heading[] } = {
    headings,
  };
  let html = parser.render(body, env);

  // Adjust data-line values for the stripped frontmatter so scroll sync
  // matches editor lines.
  if (lineOffset > 0) {
    html = html.replace(/data-line="(\d+)"/g, (_, n) => {
      return `data-line="${Number(n) + lineOffset}"`;
    });
  }

  const sanitize = options?.sanitize !== false;
  return {
    html: sanitize ? sanitizeHtml(html) : html,
    mermaidSources: env.mermaidSources ?? [],
    headings,
    frontmatterRaw: raw,
    frontmatterData: data,
  };
}
