// Shared application types (see SPEC.md sections 13-15).

export type EditorMode = "editor" | "split" | "preview" | "mermaid-studio";

export type OpenDocument = {
  id: string;
  path: string | null;
  title: string;
  content: string;
  originalContent: string;
  isDirty: boolean;
  isNew: boolean;
  encoding: "utf-8";
  lineEnding: "lf" | "crlf";
  lastSavedAt: string | null;
  lastOpenedAt: string;
  cursorPosition: {
    line: number;
    column: number;
  };
  scrollTop: number;
};

export type RecentFile = {
  path: string;
  title: string;
  openedAt: string;
};

export type RecentWorkspace = {
  path: string;
  name: string;
  openedAt: string;
};

export type AppSettings = {
  theme: "system" | "light" | "dark";
  density: "comfortable" | "compact" | "dense";
  editor: {
    fontFamily: string;
    fontSize: number;
    lineHeight: number;
    tabSize: number;
    wordWrap: boolean;
    minimap: boolean;
    autoSave: boolean;
    autoSaveDelayMs: number;
  };
  preview: {
    theme: string;
    syncScroll: boolean;
    sanitizeHtml: boolean;
  };
  mermaid: {
    theme: "default" | "dark" | "forest" | "neutral";
    securityLevel: string;
    startOnLoad: boolean;
    htmlLabels: boolean;
  };
  export: {
    defaultFormat: string;
    includeStyles: boolean;
    includeMermaidDiagrams: boolean;
  };
  files: {
    restoreLastSession: boolean;
    confirmBeforeDelete: boolean;
    createBackups: boolean;
  };
};

export const DEFAULT_SETTINGS: AppSettings = {
  theme: "system",
  density: "comfortable",
  editor: {
    fontFamily: "JetBrains Mono, Menlo, Consolas, monospace",
    fontSize: 14,
    lineHeight: 1.6,
    tabSize: 2,
    wordWrap: true,
    minimap: false,
    autoSave: true,
    autoSaveDelayMs: 750,
  },
  preview: {
    theme: "github",
    syncScroll: true,
    sanitizeHtml: true,
  },
  mermaid: {
    theme: "default",
    securityLevel: "strict",
    startOnLoad: false,
    htmlLabels: false,
  },
  export: {
    defaultFormat: "pdf",
    includeStyles: true,
    includeMermaidDiagrams: true,
  },
  files: {
    restoreLastSession: true,
    confirmBeforeDelete: true,
    createBackups: true,
  },
};

// ---- Backend command payloads ----

export type TextFileResponse = {
  path: string;
  content: string;
  encoding: string;
  lineEnding: string;
  modifiedAt: string | null;
};

export type FileEntry = {
  name: string;
  path: string;
  isDir: boolean;
  extension: string | null;
  size: number | null;
  modifiedAt: string | null;
};

export type WorkspaceTree = {
  root: string;
  entries: FileEntry[];
};

export type WorkspaceSettings = {
  name: string;
  defaultExportFormat: string;
  previewTheme: string;
  mermaidTheme: string;
  assetsFolder: string;
  exclude: string[];
};

export type SearchResult = {
  path: string;
  line: number;
  column: number;
  preview: string;
};

export type GitFileStatus = {
  path: string;
  status: "new" | "added" | "deleted" | "modified";
};

export type GitStatus = {
  isRepo: boolean;
  branch: string | null;
  files: GitFileStatus[];
};

export type ExportResult = {
  suggestedFilename: string;
  mimeType: string;
  bytesBase64: string;
};

export type RecoverySnapshot = {
  id: string;
  documentId: string;
  path: string | null;
  title: string | null;
  createdAt: string;
  size: number;
};

export type AppError = {
  kind: string;
  message: string;
};

export function isAppError(err: unknown): err is AppError {
  return (
    typeof err === "object" &&
    err !== null &&
    "kind" in err &&
    "message" in err
  );
}

export function errorMessage(err: unknown): string {
  if (isAppError(err)) return err.message;
  if (err instanceof Error) return err.message;
  return String(err);
}

// ---- Mermaid ----

export type MermaidError = {
  message: string;
  line?: number;
  column?: number;
  raw?: string;
};

export type MermaidRenderResult = {
  id: string;
  source: string;
  svg: string | null;
  error: MermaidError | null;
  renderedAt: string;
};

export type MermaidBlock = {
  /** Zero-based index of the mermaid block within the document. */
  index: number;
  source: string;
  language: string;
  /** 1-based line of the opening fence. */
  startLine: number;
  /** 1-based line of the closing fence. */
  endLine: number;
  /** Detected diagram type, e.g. "flowchart". */
  type: string;
};

// ---- Linting ----

export type LintFinding = {
  id: string;
  severity: "info" | "warning" | "error";
  message: string;
  line: number;
  column?: number;
  source: "markdown" | "mermaid" | "links" | "export";
  fix?: {
    label: string;
    apply: () => void;
  };
};

// ---- Commands ----

export type CommandItem = {
  id: string;
  title: string;
  category: string;
  keywords: string[];
  shortcut?: string;
  /** Returns false when the command should be disabled. */
  enabled?: () => boolean;
  run: () => void | Promise<void>;
};

// ---- Snippets / templates ----

export type Snippet = {
  id: string;
  name: string;
  description: string;
  body: string;
  builtIn?: boolean;
};

export type DocumentTemplate = {
  id: string;
  name: string;
  description: string;
  filename: string;
  content: string;
};
