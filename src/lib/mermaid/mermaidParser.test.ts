import { describe, expect, it } from "vitest";

import {
  contentHash,
  detectDiagramType,
  extractMermaidBlocks,
  isMermaidLanguage,
  replaceMermaidBlock,
} from "./mermaidParser";

describe("isMermaidLanguage", () => {
  it("matches all spec aliases", () => {
    for (const alias of [
      "mermaid",
      "mmd",
      "diagram",
      "mermaid-flowchart",
      "mermaid-sequence",
      "MERMAID",
    ]) {
      expect(isMermaidLanguage(alias)).toBe(true);
    }
  });

  it("rejects other languages", () => {
    expect(isMermaidLanguage("js")).toBe(false);
    expect(isMermaidLanguage("")).toBe(false);
    expect(isMermaidLanguage(null)).toBe(false);
  });
});

describe("extractMermaidBlocks", () => {
  const md = [
    "# Doc",
    "",
    "```mermaid",
    "flowchart TD",
    "  A --> B",
    "```",
    "",
    "```js",
    "const x = 1;",
    "```",
    "",
    "```mmd",
    "sequenceDiagram",
    "  A->>B: hi",
    "```",
  ].join("\n");

  it("finds only mermaid blocks with correct lines", () => {
    const blocks = extractMermaidBlocks(md);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].startLine).toBe(3);
    expect(blocks[0].endLine).toBe(6);
    expect(blocks[0].type).toBe("flowchart");
    expect(blocks[1].type).toBe("sequence");
    expect(blocks[1].source).toContain("sequenceDiagram");
  });

  it("handles unclosed fences gracefully", () => {
    const blocks = extractMermaidBlocks("```mermaid\nflowchart TD\n");
    expect(blocks).toHaveLength(0);
  });
});

describe("detectDiagramType", () => {
  it("detects types and skips directives", () => {
    expect(detectDiagramType("%% comment\nflowchart LR")).toBe("flowchart");
    expect(detectDiagramType("graph TD")).toBe("flowchart");
    expect(detectDiagramType("erDiagram")).toBe("er");
    expect(detectDiagramType("pie\n  \"a\": 1")).toBe("pie");
    expect(detectDiagramType("unknown thing")).toBe("diagram");
  });
});

describe("contentHash", () => {
  it("is stable and distinguishes content", () => {
    expect(contentHash("abc")).toBe(contentHash("abc"));
    expect(contentHash("abc")).not.toBe(contentHash("abd"));
  });
});

describe("replaceMermaidBlock", () => {
  it("replaces the targeted block only", () => {
    const md = "```mermaid\nflowchart TD\n```\n\n```mermaid\npie\n```";
    const result = replaceMermaidBlock(md, 1, "gantt\n  title X");
    expect(result).toContain("flowchart TD");
    expect(result).toContain("gantt");
    expect(result).not.toContain("pie");
  });

  it("returns null for a missing index", () => {
    expect(replaceMermaidBlock("no blocks here", 0, "x")).toBeNull();
  });
});
