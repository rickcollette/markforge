import { useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronRight } from "lucide-react";

import { MENUS, type MenuEntry } from "@/lib/commands/menus";
import {
  getCommand,
  isCommandEnabled,
  runCommand,
} from "@/lib/commands/registry";
import { useDocumentStore } from "@/state/documentStore";
import { useWorkspaceStore } from "@/state/workspaceStore";

function DynamicEntries({ kind }: { kind: "recent-files" | "recent-workspaces" }) {
  const recentFiles = useDocumentStore((s) => s.recentFiles);
  const recentWorkspaces = useWorkspaceStore((s) => s.recentWorkspaces);
  const openPath = useDocumentStore((s) => s.openPath);
  const openWorkspacePath = useWorkspaceStore((s) => s.openWorkspacePath);

  const items =
    kind === "recent-files"
      ? recentFiles.map((f) => ({
          key: f.path,
          label: f.title,
          hint: f.path,
          run: () => void openPath(f.path, { allow: true }),
        }))
      : recentWorkspaces.map((w) => ({
          key: w.path,
          label: w.name,
          hint: w.path,
          run: () => void openWorkspacePath(w.path),
        }));

  if (items.length === 0) {
    return (
      <DropdownMenu.Item className="menu-item" disabled data-disabled>
        <span>None</span>
      </DropdownMenu.Item>
    );
  }
  return (
    <>
      {items.map((item) => (
        <DropdownMenu.Item
          key={item.key}
          className="menu-item"
          title={item.hint}
          onSelect={() => item.run()}
        >
          <span className="truncate">{item.label}</span>
        </DropdownMenu.Item>
      ))}
    </>
  );
}

function Entry({ entry }: { entry: MenuEntry }) {
  if (entry.type === "separator") {
    return <DropdownMenu.Separator className="menu-separator" />;
  }
  if (entry.type === "dynamic") {
    return <DynamicEntries kind={entry.key} />;
  }
  if (entry.type === "submenu") {
    return (
      <DropdownMenu.Sub>
        <DropdownMenu.SubTrigger className="menu-item">
          <span>{entry.label}</span>
          <ChevronRight size={13} />
        </DropdownMenu.SubTrigger>
        <DropdownMenu.Portal>
          <DropdownMenu.SubContent className="menu-content" sideOffset={2}>
            {entry.items.map((item, i) => (
              <Entry key={i} entry={item} />
            ))}
          </DropdownMenu.SubContent>
        </DropdownMenu.Portal>
      </DropdownMenu.Sub>
    );
  }

  const command = getCommand(entry.id);
  if (!command) return null;
  const enabled = isCommandEnabled(entry.id);
  return (
    <DropdownMenu.Item
      className="menu-item"
      disabled={!enabled}
      onSelect={() => void runCommand(entry.id)}
    >
      <span>{entry.label ?? command.title}</span>
      {command.shortcut && (
        <span className="menu-shortcut">{command.shortcut}</span>
      )}
    </DropdownMenu.Item>
  );
}

export default function MenuBar() {
  // Re-render menus on open so enabled() predicates are fresh.
  const [, setOpenMenu] = useState<string | null>(null);

  return (
    <div
      className="flex h-8 shrink-0 items-center border-b px-1"
      style={{
        background: "var(--bg-panel)",
        borderColor: "var(--border-subtle)",
      }}
      role="menubar"
      aria-label="Application menu"
    >
      {MENUS.map((menu) => (
        <DropdownMenu.Root
          key={menu.label}
          onOpenChange={(open) => setOpenMenu(open ? menu.label : null)}
        >
          <DropdownMenu.Trigger asChild>
            <button className="btn" aria-haspopup="menu">
              {menu.label}
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="menu-content"
              align="start"
              sideOffset={2}
            >
              {menu.items.map((entry, i) => (
                <Entry key={i} entry={entry} />
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      ))}
    </div>
  );
}
