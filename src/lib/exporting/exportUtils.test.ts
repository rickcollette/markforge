import { describe, expect, it } from "vitest";

import {
  markdownToPlainText,
  slugifyTitle,
  splitSlides,
  stringToBase64,
} from "./exportUtils";

describe("slugifyTitle", () => {
  it("slugifies titles and drops extensions", () => {
    expect(slugifyTitle("My Doc.md")).toBe("my-doc");
    expect(slugifyTitle("Wild  Chars!?")).toBe("wild-chars");
    expect(slugifyTitle("...")).toBe("document");
  });
});

describe("splitSlides", () => {
  it("splits on --- outside fences", () => {
    const md = "# One\n\n---\n\n# Two\n\n```\n---\n```\n";
    const slides = splitSlides(md);
    expect(slides).toHaveLength(2);
    expect(slides[1]).toContain("# Two");
    expect(slides[1]).toContain("---"); // the fenced one stays
  });

  it("splits on slide comments", () => {
    const slides = splitSlides("a\n<!-- slide -->\nb");
    expect(slides).toHaveLength(2);
  });

  it("ignores frontmatter delimiters", () => {
    const slides = splitSlides("---\ntitle: x\n---\n# Only Slide");
    expect(slides).toHaveLength(1);
  });
});

describe("markdownToPlainText", () => {
  it("strips formatting", () => {
    const text = markdownToPlainText(
      "# Title\n\n**bold** and *italic* with [link](http://x) and `code`",
    );
    expect(text).toContain("Title");
    expect(text).toContain("bold and italic with link and code");
    expect(text).not.toContain("**");
    expect(text).not.toContain("](");
  });
});

describe("stringToBase64", () => {
  it("encodes unicode safely", () => {
    expect(atob(stringToBase64("hello"))).toBe("hello");
    expect(stringToBase64("héllo ✓")).toBeTruthy();
  });
});
