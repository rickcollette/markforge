export type MermaidTemplate = {
  id: string;
  name: string;
  type: string;
  description: string;
  source: string;
};

export const MERMAID_TEMPLATES: MermaidTemplate[] = [
  {
    id: "flowchart",
    name: "Flowchart",
    type: "flowchart",
    description: "Decision flow with branches.",
    source: `flowchart TD
  Start([Start]) --> Decision{Decision}
  Decision -->|Yes| Action[Action]
  Decision -->|No| Stop([Stop])
  Action --> Stop`,
  },
  {
    id: "sequence",
    name: "Sequence Diagram",
    type: "sequence",
    description: "Message flow between participants.",
    source: `sequenceDiagram
  participant User
  participant App
  participant Backend
  User->>App: Perform action
  App->>Backend: Send request
  Backend-->>App: Return result
  App-->>User: Show response`,
  },
  {
    id: "class",
    name: "Class Diagram",
    type: "class",
    description: "Classes, fields and methods.",
    source: `classDiagram
  class Document {
    +String id
    +String title
    +String path
    +save()
    +render()
  }`,
  },
  {
    id: "state",
    name: "State Diagram",
    type: "state",
    description: "State machine transitions.",
    source: `stateDiagram-v2
  [*] --> Draft
  Draft --> Editing
  Editing --> Saved
  Saved --> Published`,
  },
  {
    id: "er",
    name: "Entity Relationship",
    type: "er",
    description: "Entities and relations.",
    source: `erDiagram
  DOCUMENT ||--o{ DIAGRAM : contains
  DOCUMENT {
    string id
    string title
    string path
  }
  DIAGRAM {
    string id
    string type
    string source
  }`,
  },
  {
    id: "gantt",
    name: "Gantt Chart",
    type: "gantt",
    description: "Project schedule.",
    source: `gantt
  title Project Plan
  dateFormat YYYY-MM-DD
  section Build
  Design :a1, 2026-01-01, 7d
  Develop :after a1, 14d`,
  },
  {
    id: "pie",
    name: "Pie Chart",
    type: "pie",
    description: "Proportional values.",
    source: `pie title Document Types
  "Specs" : 40
  "Notes" : 25
  "Docs" : 35`,
  },
  {
    id: "mindmap",
    name: "Mindmap",
    type: "mindmap",
    description: "Hierarchical ideas.",
    source: `mindmap
  root((Project))
    Editor
      Markdown
      Preview
    Diagrams
      Mermaid
      Export`,
  },
  {
    id: "timeline",
    name: "Timeline",
    type: "timeline",
    description: "Chronological phases.",
    source: `timeline
  title Product Timeline
  Phase 1 : Core editor
  Phase 2 : Mermaid Studio
  Phase 3 : Export system`,
  },
];

export function templateById(id: string): MermaidTemplate | undefined {
  return MERMAID_TEMPLATES.find((t) => t.id === id);
}

export function asFencedBlock(source: string): string {
  return "```mermaid\n" + source.replace(/\n$/, "") + "\n```";
}
