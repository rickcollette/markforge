import { describe, expect, it } from "vitest";

import {
  cleanMarkdown,
  convertToTable,
  convertToTaskList,
  fixMermaidIndentation,
  formatAllTables,
  formatTableLines,
  normalizeHeadings,
  renumberOrderedLists,
  sortLines,
  trimTrailingWhitespace,
  unwrapParagraph,
  wrapParagraph,
} from "./markdownFormatter";

describe("formatTableLines", () => {
  it("aligns columns", () => {
    const result = formatTableLines([
      "| a | bbbb |",
      "|---|---|",
      "| cc | d |",
    ]);
    expect(result).toEqual([
      "| a   | bbbb |",
      "| --- | ---- |",
      "| cc  | d    |",
    ]);
  });

  it("preserves alignment markers", () => {
    const result = formatTableLines(["| x | y |", "|:---|---:|", "| 1 | 2 |"]);
    expect(result[1]).toContain(":");
    expect(result[1].trim().endsWith(": |")).toBe(true);
  });

  it("returns input unchanged when not a table", () => {
    const lines = ["just text"];
    expect(formatTableLines(lines)).toEqual(lines);
  });
});

describe("formatAllTables", () => {
  it("skips tables inside code fences", () => {
    const md = "```\n| a | b |\n|---|---|\n```\n";
    expect(formatAllTables(md)).toBe(md);
  });
});

describe("trimTrailingWhitespace", () => {
  it("removes trailing spaces and tabs", () => {
    expect(trimTrailingWhitespace("a  \nb\t\nc")).toBe("a\nb\nc");
  });
});

describe("sortLines", () => {
  it("sorts alphabetically", () => {
    expect(sortLines("b\na\nc")).toBe("a\nb\nc");
  });
});

describe("renumberOrderedLists", () => {
  it("renumbers sequentially", () => {
    expect(renumberOrderedLists("1. a\n5. b\n9. c")).toBe("1. a\n2. b\n3. c");
  });

  it("handles nested lists", () => {
    const input = "1. a\n   7. nested\n   9. nested2\n4. b";
    const output = renumberOrderedLists(input);
    expect(output).toBe("1. a\n   1. nested\n   2. nested2\n2. b");
  });
});

describe("normalizeHeadings", () => {
  it("fixes skipped levels", () => {
    expect(normalizeHeadings("# A\n### B")).toBe("# A\n## B");
  });

  it("leaves valid sequences alone", () => {
    const md = "# A\n## B\n### C";
    expect(normalizeHeadings(md)).toBe(md);
  });
});

describe("convertToTable", () => {
  it("converts CSV lines", () => {
    const result = convertToTable("a,b\n1,2");
    expect(result).toContain("| a   | b   |");
    expect(result).toContain("| 1   | 2   |");
  });
});

describe("convertToTaskList", () => {
  it("converts plain and bulleted lines", () => {
    expect(convertToTaskList("one\n- two")).toBe("- [ ] one\n- [ ] two");
  });

  it("keeps existing checkboxes", () => {
    expect(convertToTaskList("- [x] done")).toBe("- [x] done");
  });
});

describe("wrap/unwrap paragraph", () => {
  it("wraps long text at the column", () => {
    const text = Array(30).fill("word").join(" ");
    const wrapped = wrapParagraph(text, 40);
    for (const line of wrapped.split("\n")) {
      expect(line.length).toBeLessThanOrEqual(40);
    }
  });

  it("unwrap joins lines but keeps paragraph breaks", () => {
    expect(unwrapParagraph("a\nb\n\nc")).toBe("a b\n\nc");
  });
});

describe("fixMermaidIndentation", () => {
  it("dedents indented mermaid fences", () => {
    const input = "  ```mermaid\n  flowchart TD\n  ```";
    const output = fixMermaidIndentation(input);
    expect(output).toBe("```mermaid\nflowchart TD\n```");
  });
});

describe("cleanMarkdown", () => {
  it("trims whitespace, collapses blank lines, ends with newline", () => {
    const result = cleanMarkdown("a  \n\n\n\n\nb");
    expect(result).toBe("a\n\n\nb\n");
  });
});
