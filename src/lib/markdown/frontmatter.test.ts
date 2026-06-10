import { describe, expect, it } from "vitest";

import {
  applyFrontmatter,
  applyRawFrontmatter,
  extractFrontmatter,
} from "./frontmatter";

describe("extractFrontmatter", () => {
  it("parses YAML frontmatter", () => {
    const result = extractFrontmatter(
      "---\ntitle: Hello\ntags:\n  - a\n---\n# Body\n",
    );
    expect(result.data).toEqual({ title: "Hello", tags: ["a"] });
    expect(result.body).toBe("# Body\n");
    expect(result.lineOffset).toBe(5);
  });

  it("returns body unchanged without frontmatter", () => {
    const result = extractFrontmatter("# Just a doc");
    expect(result.raw).toBeNull();
    expect(result.body).toBe("# Just a doc");
    expect(result.lineOffset).toBe(0);
  });

  it("tolerates invalid YAML", () => {
    const result = extractFrontmatter("---\n[: bad\n---\nbody");
    expect(result.data).toBeNull();
    expect(result.body).toBe("body");
  });
});

describe("applyFrontmatter", () => {
  it("round-trips data", () => {
    const md = applyFrontmatter("# Body", { title: "T", draft: true });
    const parsed = extractFrontmatter(md);
    expect(parsed.data).toEqual({ title: "T", draft: true });
    expect(parsed.body.trim()).toBe("# Body");
  });

  it("removes frontmatter when data is empty", () => {
    const md = applyFrontmatter("---\ntitle: x\n---\n# Body", {});
    expect(md).toBe("# Body");
  });
});

describe("applyRawFrontmatter", () => {
  it("replaces existing raw block", () => {
    const md = applyRawFrontmatter("---\nold: 1\n---\nbody", "new: 2");
    expect(md).toBe("---\nnew: 2\n---\nbody");
  });
});
