import {
  Bold,
  Code,
  Columns2,
  Eye,
  FilePlus,
  FolderOpen,
  Heading1,
  Heading2,
  Image,
  Italic,
  Link,
  List,
  ListOrdered,
  ListTodo,
  PenSquare,
  Quote,
  Redo2,
  Save,
  Strikethrough,
  Table,
  Undo2,
  Workflow,
} from "lucide-react";

import { isCommandEnabled, runCommand, getCommand } from "@/lib/commands/registry";
import { useAppStore } from "@/state/appStore";
import { useDocumentStore } from "@/state/documentStore";

type ButtonDef = {
  commandId: string;
  icon: React.ComponentType<{ size?: number }>;
  modeButton?: "editor" | "split" | "preview" | "mermaid-studio";
};

const GROUPS: ButtonDef[][] = [
  [
    { commandId: "file.new", icon: FilePlus },
    { commandId: "file.open", icon: FolderOpen },
    { commandId: "file.save", icon: Save },
  ],
  [
    { commandId: "edit.undo", icon: Undo2 },
    { commandId: "edit.redo", icon: Redo2 },
  ],
  [
    { commandId: "insert.h1", icon: Heading1 },
    { commandId: "insert.h2", icon: Heading2 },
    { commandId: "insert.bold", icon: Bold },
    { commandId: "insert.italic", icon: Italic },
    { commandId: "insert.strikethrough", icon: Strikethrough },
    { commandId: "insert.inlineCode", icon: Code },
  ],
  [
    { commandId: "insert.unorderedList", icon: List },
    { commandId: "insert.orderedList", icon: ListOrdered },
    { commandId: "insert.taskList", icon: ListTodo },
    { commandId: "insert.blockquote", icon: Quote },
  ],
  [
    { commandId: "insert.link", icon: Link },
    { commandId: "insert.image", icon: Image },
    { commandId: "insert.table", icon: Table },
    { commandId: "insert.mermaid", icon: Workflow },
  ],
  [
    { commandId: "view.editorOnly", icon: PenSquare, modeButton: "editor" },
    { commandId: "view.split", icon: Columns2, modeButton: "split" },
    { commandId: "view.previewOnly", icon: Eye, modeButton: "preview" },
    {
      commandId: "view.mermaidStudio",
      icon: Workflow,
      modeButton: "mermaid-studio",
    },
  ],
];

export default function Toolbar() {
  const mode = useAppStore((s) => s.editorMode);
  // Subscribe so enabled-state refreshes as documents change.
  useDocumentStore((s) => s.openDocuments.length + (s.activeDocumentId ?? ""));
  useDocumentStore((s) =>
    s.openDocuments.filter((d) => d.isDirty).length,
  );

  return (
    <div
      className="flex h-9 shrink-0 items-center gap-0.5 border-b px-2"
      style={{
        background: "var(--bg-panel)",
        borderColor: "var(--border-subtle)",
      }}
      role="toolbar"
      aria-label="Editor toolbar"
    >
      {GROUPS.map((group, gi) => (
        <div key={gi} className="flex items-center gap-0.5">
          {gi > 0 && (
            <div
              className="mx-1.5 h-4 w-px"
              style={{ background: "var(--border-subtle)" }}
            />
          )}
          {group.map(({ commandId, icon: Icon, modeButton }) => {
            const command = getCommand(commandId);
            const enabled = isCommandEnabled(commandId);
            return (
              <button
                key={commandId}
                className="icon-btn"
                disabled={!enabled}
                data-active={modeButton ? mode === modeButton : undefined}
                title={
                  command
                    ? command.shortcut
                      ? `${command.title} (${command.shortcut})`
                      : command.title
                    : commandId
                }
                aria-label={command?.title ?? commandId}
                onClick={() => void runCommand(commandId)}
              >
                <Icon size={15} />
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
