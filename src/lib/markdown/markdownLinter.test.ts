import { describe, expect, it } from "vitest";

import { extractLinks, lintMarkdown } from "./markdownLinter";

describe("lintMarkdown", () => {
  it("flags multiple H1 headings", () => {
    const findings = lintMarkdown("# One\n\n# Two\n");
    expect(findings.some((f) => f.message.includes("Multiple H1"))).toBe(true);
  });

  it("flags skipped heading levels", () => {
    const findings = lintMarkdown("# One\n\n### Three\n");
    expect(findings.some((f) => f.message.includes("Skipped heading"))).toBe(
      true,
    );
  });

  it("flags trailing whitespace with line numbers", () => {
    const findings = lintMarkdown("# T\n\ntext  \n");
    const finding = findings.find((f) =>
      f.message.includes("Trailing whitespace"),
    );
    expect(finding?.line).toBe(3);
  });

  it("flags unclosed fences as errors", () => {
    const findings = lintMarkdown("# T\n\n```js\ncode\n");
    expect(
      findings.some(
        (f) => f.severity === "error" && f.message.includes("Unclosed"),
      ),
    ).toBe(true);
  });

  it("flags broken internal links", () => {
    const findings = lintMarkdown("# Title\n\n[go](#missing-section)\n");
    expect(findings.some((f) => f.message.includes("Broken internal"))).toBe(
      true,
    );
  });

  it("accepts valid internal links", () => {
    const findings = lintMarkdown("# My Section\n\n[go](#my-section)\n");
    expect(findings.some((f) => f.message.includes("Broken internal"))).toBe(
      false,
    );
  });

  it("flags empty links", () => {
    const findings = lintMarkdown("# T\n\n[click]()\n");
    expect(findings.some((f) => f.message.includes("empty URL"))).toBe(true);
  });

  it("flags inconsistent table columns", () => {
    const findings = lintMarkdown(
      "# T\n\n| a | b |\n|---|---|\n| 1 | 2 | 3 |\n",
    );
    expect(findings.some((f) => f.message.includes("column"))).toBe(true);
  });

  it("ignores lint targets inside code fences", () => {
    const findings = lintMarkdown("# T\n\n```\ntext   \n[x]()\n```\n");
    expect(findings.some((f) => f.message.includes("Trailing"))).toBe(false);
    expect(findings.some((f) => f.message.includes("empty URL"))).toBe(false);
  });
});

describe("extractLinks", () => {
  it("classifies link kinds", () => {
    const links = extractLinks(
      [
        "[ext](https://example.com)",
        "[anchor](#section)",
        "[file](./other.md)",
        "![img](assets/pic.png)",
        "[mail](mailto:a@b.c)",
      ].join("\n\n"),
    );
    expect(links.map((l) => l.kind)).toEqual([
      "external",
      "heading",
      "file",
      "image",
      "mailto",
    ]);
  });

  it("accounts for frontmatter line offset", () => {
    const links = extractLinks("---\ntitle: x\n---\n[a](#b)\n");
    expect(links[0].line).toBe(4);
  });
});
