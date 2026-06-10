import { Files, Search, History, Workflow } from "lucide-react";

import { useAppStore, type SidebarTab } from "@/state/appStore";
import FileTree from "@/components/workspace/FileTree";
import SearchPanel from "@/components/workspace/SearchPanel";
import RecentFiles from "@/components/workspace/RecentFiles";
import DiagramList from "@/components/workspace/DiagramList";

const TABS: { id: SidebarTab; icon: typeof Files; label: string }[] = [
  { id: "files", icon: Files, label: "Workspace files" },
  { id: "search", icon: Search, label: "Search" },
  { id: "recent", icon: History, label: "Recent" },
  { id: "diagrams", icon: Workflow, label: "Diagrams in file" },
];

export default function Sidebar() {
  const tab = useAppStore((s) => s.sidebarTab);
  const setTab = useAppStore((s) => s.setSidebarTab);
  const width = useAppStore((s) => s.sidebarWidth);

  return (
    <div
      className="flex h-full shrink-0 flex-col border-r"
      style={{
        width,
        background: "var(--bg-panel)",
        borderColor: "var(--border-subtle)",
      }}
    >
      <div
        className="flex shrink-0 items-center gap-0.5 border-b px-1.5 py-1"
        style={{ borderColor: "var(--border-subtle)" }}
        role="tablist"
        aria-label="Sidebar panels"
      >
        {TABS.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            className="icon-btn"
            data-active={tab === id}
            title={label}
            aria-label={label}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
          >
            <Icon size={15} />
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1">
        {tab === "files" && <FileTree />}
        {tab === "search" && <SearchPanel />}
        {tab === "recent" && <RecentFiles />}
        {tab === "diagrams" && <DiagramList />}
      </div>
    </div>
  );
}
