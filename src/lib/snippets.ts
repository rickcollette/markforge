import type { Snippet } from "./types";
import * as backend from "./tauri/commands";

export const BUILTIN_SNIPPETS: Snippet[] = [
  {
    id: "mermaid-flowchart-basic",
    name: "Basic Mermaid Flowchart",
    description: "Insert a simple top-down flowchart.",
    body: "```mermaid\nflowchart TD\n  A[Start] --> B[End]\n```",
    builtIn: true,
  },
  {
    id: "mermaid-sequence-basic",
    name: "Basic Sequence Diagram",
    description: "Two-participant sequence diagram.",
    body: "```mermaid\nsequenceDiagram\n  A->>B: Request\n  B-->>A: Response\n```",
    builtIn: true,
  },
  {
    id: "table-3x3",
    name: "Table 3x3",
    description: "Three-column markdown table.",
    body: "| Column 1 | Column 2 | Column 3 |\n| --- | --- | --- |\n| Value 1 | Value 2 | Value 3 |",
    builtIn: true,
  },
  {
    id: "callout-note",
    name: "Note Callout",
    description: "GitHub-style NOTE admonition.",
    body: "> [!NOTE]\n> Write your note here.",
    builtIn: true,
  },
  {
    id: "callout-warning",
    name: "Warning Callout",
    description: "GitHub-style WARNING admonition.",
    body: "> [!WARNING]\n> Write your warning here.",
    builtIn: true,
  },
  {
    id: "frontmatter",
    name: "Frontmatter Block",
    description: "YAML frontmatter with common fields.",
    body: '---\ntitle: Document Title\ndescription: ""\ntags: []\ndraft: true\n---\n',
    builtIn: true,
  },
  {
    id: "task-list",
    name: "Task List",
    description: "Checklist with three items.",
    body: "- [ ] First task\n- [ ] Second task\n- [x] Done task",
    builtIn: true,
  },
  {
    id: "details",
    name: "Collapsible Section",
    description: "HTML details/summary block.",
    body: "<details>\n<summary>Click to expand</summary>\n\nHidden content.\n\n</details>",
    builtIn: true,
  },
];

export async function loadUserSnippets(): Promise<Snippet[]> {
  try {
    const data = await backend.loadAppData<{ snippets: Snippet[] }>("snippets");
    return Array.isArray(data?.snippets) ? data.snippets : [];
  } catch {
    return [];
  }
}

export async function saveUserSnippets(snippets: Snippet[]): Promise<void> {
  await backend.saveAppData("snippets", { snippets });
}
