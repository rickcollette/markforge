import { useEffect, useRef } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";

import { monaco, setupMonaco } from "@/lib/editor/monacoSetup";
import {
  registerEditorBridge,
  useDocumentStore,
  type EditorBridge,
} from "@/state/documentStore";
import { useSettingsStore } from "@/state/settingsStore";
import { useAppStore } from "@/state/appStore";

setupMonaco();

type Props = {
  documentId: string;
  path: string | null;
  value: string;
  language?: string;
  /** Report the first visible line for preview scroll sync. */
  onVisibleLineChange?: (line: number) => void;
  /** Imperative scroll used by preview -> editor sync. */
  registerScrollToLine?: (fn: (line: number) => void) => void;
  onChange: (value: string) => void;
};

export default function MonacoMarkdown({
  documentId,
  path,
  value,
  language = "markdown",
  onVisibleLineChange,
  registerScrollToLine,
  onChange,
}: Props) {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const suppressScrollEvent = useRef(0);
  const settings = useSettingsStore((s) => s.settings);
  const typewriterMode = useAppStore((s) => s.typewriterMode);
  const lintFindings = useAppStore((s) => s.lintFindings);
  const isDarkTheme = document.documentElement.classList.contains("dark");

  const options: monaco.editor.IStandaloneEditorConstructionOptions = {
    fontFamily: settings.editor.fontFamily,
    fontSize: settings.editor.fontSize,
    lineHeight: Math.round(settings.editor.fontSize * settings.editor.lineHeight),
    tabSize: settings.editor.tabSize,
    wordWrap: settings.editor.wordWrap ? "on" : "off",
    minimap: { enabled: settings.editor.minimap },
    lineNumbers: "on",
    renderWhitespace: "none",
    scrollBeyondLastLine: typewriterMode,
    cursorSurroundingLines: typewriterMode ? 16 : 3,
    smoothScrolling: true,
    automaticLayout: true,
    folding: true,
    matchBrackets: "always",
    multiCursorModifier: "alt",
    unicodeHighlight: { ambiguousCharacters: false },
    quickSuggestions: { other: false, comments: false, strings: false },
    suggestOnTriggerCharacters: true,
    occurrencesHighlight: "off",
    stickyScroll: { enabled: false },
    padding: { top: 12, bottom: 12 },
  };

  const handleMount: OnMount = (editor) => {
    editorRef.current = editor;

    // Force LF inside the editor regardless of platform. All frontend
    // parsing (outline, linter, scroll sync) assumes "\n"; the document
    // store converts back to the file's original ending on save.
    const forceLf = () =>
      editor.getModel()?.setEOL(monaco.editor.EndOfLineSequence.LF);
    forceLf();
    editor.onDidChangeModel(forceLf);

    const store = useDocumentStore.getState();
    const doc = store.openDocuments.find((d) => d.id === documentId);
    if (doc) {
      editor.setPosition({
        lineNumber: doc.cursorPosition.line,
        column: doc.cursorPosition.column,
      });
      editor.setScrollTop(doc.scrollTop);
    }
    editor.focus();

    editor.onDidChangeCursorPosition((e) => {
      useDocumentStore
        .getState()
        .setCursor(documentId, e.position.lineNumber, e.position.column);
    });

    editor.onDidScrollChange((e) => {
      useDocumentStore.getState().setScrollTop(documentId, e.scrollTop);
      if (Date.now() < suppressScrollEvent.current) return;
      const ranges = editor.getVisibleRanges();
      if (ranges.length > 0 && onVisibleLineChange) {
        onVisibleLineChange(ranges[0].startLineNumber);
      }
    });

    registerScrollToLine?.((line) => {
      suppressScrollEvent.current = Date.now() + 250;
      editor.revealLineNearTop(line, monaco.editor.ScrollType.Smooth);
    });

    registerEditorBridge(createBridge(editor));
  };

  // Re-register the bridge when the active document changes so commands
  // target the correct editor instance.
  useEffect(() => {
    const editor = editorRef.current;
    if (editor) registerEditorBridge(createBridge(editor));
    return () => registerEditorBridge(null);
  }, [documentId]);

  // Lint markers.
  useEffect(() => {
    const editor = editorRef.current;
    const model = editor?.getModel();
    if (!model) return;
    const markers: monaco.editor.IMarkerData[] = lintFindings.map((f) => ({
      severity:
        f.severity === "error"
          ? monaco.MarkerSeverity.Error
          : f.severity === "warning"
            ? monaco.MarkerSeverity.Warning
            : monaco.MarkerSeverity.Info,
      message: f.message,
      startLineNumber: Math.min(f.line, model.getLineCount()),
      startColumn: f.column ?? 1,
      endLineNumber: Math.min(f.line, model.getLineCount()),
      endColumn: model.getLineMaxColumn(Math.min(f.line, model.getLineCount())),
    }));
    monaco.editor.setModelMarkers(model, "markforge-lint", markers);
  }, [lintFindings, value]);

  return (
    <Editor
      path={path ?? `inmemory://model/${documentId}`}
      language={language}
      value={value}
      onChange={(v) => onChange(v ?? "")}
      onMount={handleMount}
      theme={isDarkTheme ? "vs-dark" : "vs"}
      options={options}
      loading={<div className="mermaid-loading">Loading editor…</div>}
    />
  );
}

function createBridge(
  editor: monaco.editor.IStandaloneCodeEditor,
): EditorBridge {
  const model = () => editor.getModel();

  const getSelectionText = () => {
    const sel = editor.getSelection();
    const m = model();
    if (!sel || !m) return "";
    return m.getValueInRange(sel);
  };

  return {
    insertText: (text) => {
      const sel = editor.getSelection();
      if (!sel) return;
      editor.executeEdits("markforge", [
        { range: sel, text, forceMoveMarkers: true },
      ]);
      editor.focus();
    },

    wrapSelection: (before, after, placeholder = "text") => {
      const sel = editor.getSelection();
      const m = model();
      if (!sel || !m) return;
      const selected = m.getValueInRange(sel);
      if (selected) {
        // Toggle off when already wrapped.
        const text =
          selected.startsWith(before) && selected.endsWith(after)
            ? selected.slice(before.length, selected.length - after.length)
            : `${before}${selected}${after}`;
        editor.executeEdits("markforge", [
          { range: sel, text, forceMoveMarkers: true },
        ]);
      } else {
        const text = `${before}${placeholder}${after}`;
        editor.executeEdits("markforge", [
          { range: sel, text, forceMoveMarkers: true },
        ]);
        const start = sel.getStartPosition();
        const beforeLines = before.split("\n");
        const lineDelta = beforeLines.length - 1;
        const startLine = start.lineNumber + lineDelta;
        const startCol =
          lineDelta > 0
            ? beforeLines[beforeLines.length - 1].length + 1
            : start.column + before.length;
        editor.setSelection(
          new monaco.Selection(
            startLine,
            startCol,
            startLine,
            startCol + placeholder.length,
          ),
        );
      }
      editor.focus();
    },

    togglePrefix: (prefix) => {
      const sel = editor.getSelection();
      const m = model();
      if (!sel || !m) return;
      const startLine = sel.startLineNumber;
      const endLine = sel.endLineNumber;
      const edits: monaco.editor.IIdentifiedSingleEditOperation[] = [];
      const headingLike = /^#{1,6} $/.test(prefix);
      let allPrefixed = true;
      for (let line = startLine; line <= endLine; line++) {
        if (!m.getLineContent(line).startsWith(prefix)) {
          allPrefixed = false;
          break;
        }
      }
      for (let line = startLine; line <= endLine; line++) {
        const content = m.getLineContent(line);
        if (allPrefixed) {
          edits.push({
            range: new monaco.Range(line, 1, line, prefix.length + 1),
            text: "",
          });
        } else {
          // For headings, replace any existing heading marker first.
          const cleaned = headingLike ? content.replace(/^#{1,6} /, "") : content;
          edits.push({
            range: new monaco.Range(line, 1, line, content.length + 1),
            text: prefix + cleaned,
          });
        }
      }
      editor.executeEdits("markforge", edits);
      editor.focus();
    },

    replaceSelection: (transform, fallbackWholeDoc = false) => {
      const sel = editor.getSelection();
      const m = model();
      if (!m) return;
      const hasSelection = sel && !sel.isEmpty();
      if (!hasSelection && fallbackWholeDoc) {
        const text = transform(m.getValue());
        editor.executeEdits("markforge", [
          { range: m.getFullModelRange(), text },
        ]);
      } else if (hasSelection && sel) {
        const text = transform(m.getValueInRange(sel));
        editor.executeEdits("markforge", [
          { range: sel, text, forceMoveMarkers: true },
        ]);
      }
      editor.focus();
    },

    replaceRange: (startLine, endLine, text) => {
      const m = model();
      if (!m) return;
      const range = new monaco.Range(
        startLine,
        1,
        Math.min(endLine, m.getLineCount()),
        m.getLineMaxColumn(Math.min(endLine, m.getLineCount())),
      );
      editor.executeEdits("markforge", [
        { range, text, forceMoveMarkers: true },
      ]);
    },

    getSelection: getSelectionText,

    focus: () => editor.focus(),

    goToLine: (line, column = 1) => {
      editor.setPosition({ lineNumber: line, column });
      editor.revealLineInCenter(line, monaco.editor.ScrollType.Smooth);
      editor.focus();
    },

    runEditorAction: (actionId) => {
      if (actionId === "undo" || actionId === "redo") {
        editor.focus();
        editor.trigger("markforge", actionId, null);
        return;
      }
      editor.focus();
      const action = editor.getAction(actionId);
      if (action) void action.run();
    },
  };
}
