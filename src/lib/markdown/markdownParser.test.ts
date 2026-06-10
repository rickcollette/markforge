import { describe, expect, it } from "vitest";

import { extractHeadings, renderMarkdown, sanitizeHtml } from "./markdownParser";

describe("renderMarkdown", () => {
  it("renders basic markdown with data-line attributes", () => {
    const { html } = renderMarkdown("# Title\n\nParagraph text");
    expect(html).toContain("<h1");
    expect(html).toContain('data-line="1"');
    expect(html).toContain("Paragraph text");
  });

  it("replaces mermaid fences with placeholders", () => {
    const { html, mermaidSources } = renderMarkdown(
      "```mermaid\nflowchart TD\n  A-->B\n```",
    );
    expect(html).toContain('data-mermaid-index="0"');
    expect(mermaidSources).toHaveLength(1);
    expect(mermaidSources[0]).toContain("flowchart TD");
  });

  it("strips script tags and event handlers", () => {
    const { html } = renderMarkdown(
      '<script>alert(1)</script>\n\n<img src="x" onerror="alert(1)">',
    );
    expect(html).not.toContain("<script");
    expect(html).not.toContain("onerror");
  });

  it("never produces javascript: hrefs", () => {
    const { html } = renderMarkdown(
      '[click](javascript:alert(1))\n\n<a href="javascript:alert(1)">x</a>',
    );
    expect(html).not.toContain('href="javascript:');
  });

  it("extracts frontmatter and offsets data-line", () => {
    const { html, frontmatterData } = renderMarkdown(
      "---\ntitle: X\n---\n# Heading",
    );
    expect(frontmatterData).toEqual({ title: "X" });
    expect(html).toContain('data-line="4"');
  });

  it("renders GitHub-style callouts", () => {
    const { html } = renderMarkdown("> [!NOTE]\n> Useful info");
    expect(html).toContain("callout-note");
    expect(html).not.toContain("[!NOTE]");
  });

  it("renders task lists", () => {
    const { html } = renderMarkdown("- [ ] todo\n- [x] done");
    expect(html).toContain('type="checkbox"');
  });

  it("renders [[toc]]", () => {
    const { html } = renderMarkdown("# A\n\n[[toc]]\n\n## B");
    expect(html).toContain('class="toc"');
    expect(html).toContain('href="#b"');
  });
});

describe("extractHeadings", () => {
  it("collects headings with slugs and lines", () => {
    const headings = extractHeadings("# Top\n\ntext\n\n## Sub Section");
    expect(headings).toEqual([
      { level: 1, text: "Top", line: 1, slug: "top" },
      { level: 2, text: "Sub Section", line: 5, slug: "sub-section" },
    ]);
  });

  it("dedupes repeated slugs", () => {
    const headings = extractHeadings("## Same\n\n## Same");
    expect(headings[1].slug).toBe("same-1");
  });

  it("ignores headings inside fences", () => {
    const headings = extractHeadings("```\n# not a heading\n```");
    expect(headings).toHaveLength(0);
  });
});

describe("sanitizeHtml", () => {
  it("keeps data-line and mermaid attributes", () => {
    const html = sanitizeHtml(
      '<div class="mermaid-block" data-mermaid-index="0" data-line="3"></div>',
    );
    expect(html).toContain("data-mermaid-index");
    expect(html).toContain("data-line");
  });
});
