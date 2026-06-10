import { useCallback, useEffect, useRef } from "react";

import MonacoMarkdown from "./MonacoMarkdown";
import MarkdownPreview from "@/components/preview/MarkdownPreview";
import ResizeHandle from "@/components/ui/ResizeHandle";
import { useAppStore } from "@/state/appStore";
import { useDocumentStore } from "@/state/documentStore";
import { useSettingsStore } from "@/state/settingsStore";
import { lintMarkdown } from "@/lib/markdown/markdownLinter";
import { extractMermaidBlocks } from "@/lib/mermaid/mermaidParser";
import { validateMermaid } from "@/lib/mermaid/mermaidConfig";
import type { LintFinding, OpenDocument } from "@/lib/types";

type Props = { doc: OpenDocument };

/** Editor + preview layouts with bidirectional scroll sync. */
export default function MarkdownEditor({ doc }: Props) {
  const mode = useAppStore((s) => s.editorMode);
  const splitRatio = useAppStore((s) => s.splitRatio);
  const syncScroll = useSettingsStore((s) => s.settings.preview.syncScroll);
  const setContent = useDocumentStore((s) => s.setContent);

  const previewScrollRef = useRef<((line: number) => void) | null>(null);
  const editorScrollRef = useRef<((line: number) => void) | null>(null);
  const splitContainerRef = useRef<HTMLDivElement>(null);

  const onChange = useCallback(
    (value: string) => setContent(doc.id, value),
    [doc.id, setContent],
  );

  // Linting (debounced) + async mermaid validation.
  useEffect(() => {
    const timer = setTimeout(async () => {
      const findings: LintFinding[] = lintMarkdown(doc.content);
      const blocks = extractMermaidBlocks(doc.content);
      for (const block of blocks) {
        const error = await validateMermaid(block.source);
        if (error) {
          findings.push({
            id: `mermaid-${block.index}`,
            severity: "error",
            message: `Mermaid: ${error.message}`,
            line: block.startLine + (error.line ?? 1),
            source: "mermaid",
          });
        }
      }
      useAppStore.getState().setLintFindings(findings);
    }, 700);
    return () => clearTimeout(timer);
  }, [doc.content, doc.id]);

  const editorPane = (
    <MonacoMarkdown
      documentId={doc.id}
      path={doc.path}
      value={doc.content}
      onChange={onChange}
      onVisibleLineChange={
        syncScroll && mode === "split"
          ? (line) => previewScrollRef.current?.(line)
          : undefined
      }
      registerScrollToLine={(fn) => {
        editorScrollRef.current = fn;
      }}
    />
  );

  const previewPane = (
    <MarkdownPreview
      markdown={doc.content}
      docPath={doc.path}
      onVisibleLineChange={
        syncScroll && mode === "split"
          ? (line) => editorScrollRef.current?.(line)
          : undefined
      }
      registerScrollToLine={(fn) => {
        previewScrollRef.current = fn;
      }}
    />
  );

  if (mode === "preview") {
    return <div className="h-full">{previewPane}</div>;
  }
  if (mode === "split") {
    return (
      <div ref={splitContainerRef} className="flex h-full overflow-hidden">
        <div
          className="h-full min-w-0 overflow-hidden border-r"
          style={{
            width: `${splitRatio * 100}%`,
            borderColor: "var(--border-subtle)",
          }}
        >
          {editorPane}
        </div>
        <ResizeHandle
          label="Resize editor/preview split"
          onDelta={(dx) => {
            const total = splitContainerRef.current?.clientWidth ?? 0;
            if (total <= 0) return;
            const s = useAppStore.getState();
            s.setSplitRatio(s.splitRatio + dx / total);
          }}
          onReset={() => useAppStore.getState().setSplitRatio(0.5)}
        />
        <div className="h-full min-w-0 flex-1 overflow-hidden">
          {previewPane}
        </div>
      </div>
    );
  }
  return <div className="h-full">{editorPane}</div>;
}
