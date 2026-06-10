// Monaco bootstrap: bundle workers locally (no CDN), register the mermaid
// language for fence highlighting, and snippet completions.
import * as monaco from "monaco-editor";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import { loader } from "@monaco-editor/react";

import { BUILTIN_SNIPPETS } from "../snippets";
import { MERMAID_TEMPLATES, asFencedBlock } from "../mermaid/mermaidTemplates";

self.MonacoEnvironment = {
  getWorker: () => new editorWorker(),
};

loader.config({ monaco });

const MERMAID_KEYWORDS = [
  "flowchart",
  "graph",
  "sequenceDiagram",
  "classDiagram",
  "stateDiagram",
  "stateDiagram-v2",
  "erDiagram",
  "gantt",
  "pie",
  "mindmap",
  "timeline",
  "journey",
  "gitGraph",
  "participant",
  "actor",
  "loop",
  "alt",
  "else",
  "opt",
  "par",
  "and",
  "rect",
  "activate",
  "deactivate",
  "note",
  "over",
  "end",
  "subgraph",
  "direction",
  "title",
  "section",
  "dateFormat",
  "class",
  "click",
  "style",
  "classDef",
  "linkStyle",
];

const mermaidMonarch: monaco.languages.IMonarchLanguage = {
  defaultToken: "",
  ignoreCase: false,
  keywords: MERMAID_KEYWORDS,
  tokenizer: {
    root: [
      [/%%.*$/, "comment"],
      [/"[^"]*"/, "string"],
      [/\|[^|]*\|/, "string"],
      [/[A-Za-z_][\w-]*(?=\s*[[({])/, "type.identifier"],
      [
        /[A-Za-z_][\w-]*/,
        { cases: { "@keywords": "keyword", "@default": "identifier" } },
      ],
      [/-{1,3}>{1,2}|={2,3}>|\.-+>|--[xo]|<-+|:::?/, "operator"],
      [/[[\](){}<>]/, "delimiter.bracket"],
      [/\d+/, "number"],
    ],
  },
};

let initialized = false;

export function setupMonaco() {
  if (initialized) return;
  initialized = true;

  // Register mermaid (and aliases) so markdown fences highlight their body.
  for (const id of ["mermaid", "mmd", "diagram"]) {
    monaco.languages.register({ id });
    monaco.languages.setMonarchTokensProvider(id, mermaidMonarch);
    monaco.languages.setLanguageConfiguration(id, {
      comments: { lineComment: "%%" },
      brackets: [
        ["[", "]"],
        ["(", ")"],
        ["{", "}"],
      ],
      autoClosingPairs: [
        { open: "[", close: "]" },
        { open: "(", close: ")" },
        { open: "{", close: "}" },
        { open: '"', close: '"' },
      ],
    });
  }

  // Markdown snippet completions (built-in snippets + mermaid templates).
  monaco.languages.registerCompletionItemProvider("markdown", {
    triggerCharacters: ["/"],
    provideCompletionItems: (model, position) => {
      const word = model.getWordUntilPosition(position);
      const range = new monaco.Range(
        position.lineNumber,
        word.startColumn,
        position.lineNumber,
        word.endColumn,
      );
      const suggestions: monaco.languages.CompletionItem[] = [];
      for (const snippet of BUILTIN_SNIPPETS) {
        suggestions.push({
          label: snippet.name,
          kind: monaco.languages.CompletionItemKind.Snippet,
          documentation: snippet.description,
          insertText: snippet.body,
          range,
        });
      }
      for (const template of MERMAID_TEMPLATES) {
        suggestions.push({
          label: `mermaid-${template.id}`,
          kind: monaco.languages.CompletionItemKind.Snippet,
          documentation: template.description,
          insertText: asFencedBlock(template.source),
          range,
        });
      }
      return { suggestions };
    },
  });

  // Automatic list continuation on Enter is built into Monaco for markdown
  // via onEnterRules; add explicit rules for -, *, numbered and task lists.
  monaco.languages.setLanguageConfiguration("markdown", {
    onEnterRules: [
      {
        beforeText: /^\s*- \[[ xX]\] .+$/,
        action: { indentAction: monaco.languages.IndentAction.None, appendText: "- [ ] " },
      },
      {
        beforeText: /^\s*[-*+] .+$/,
        action: { indentAction: monaco.languages.IndentAction.None, appendText: "- " },
      },
      {
        beforeText: /^\s*(\d+)[.)] .+$/,
        action: { indentAction: monaco.languages.IndentAction.None, appendText: "1. " },
      },
      {
        beforeText: /^\s*> .*$/,
        action: { indentAction: monaco.languages.IndentAction.None, appendText: "> " },
      },
    ],
  });
}

export { monaco };
