import {
  AlertTriangle,
  BarChart3,
  FileCode2,
  Image,
  Link2,
  ListTree,
} from "lucide-react";

import { useAppStore, type RightPanelTab } from "@/state/appStore";
import TableOfContents from "@/components/preview/TableOfContents";
import DocumentStats from "@/components/panels/DocumentStats";
import ProblemsPanel from "@/components/panels/ProblemsPanel";
import LinkCheckerPanel from "@/components/panels/LinkCheckerPanel";
import AssetManagerPanel from "@/components/panels/AssetManagerPanel";
import FrontmatterPanel from "@/components/panels/FrontmatterPanel";

const TABS: { id: RightPanelTab; icon: typeof ListTree; label: string }[] = [
  { id: "outline", icon: ListTree, label: "Outline" },
  { id: "stats", icon: BarChart3, label: "Document stats" },
  { id: "problems", icon: AlertTriangle, label: "Problems" },
  { id: "links", icon: Link2, label: "Link checker" },
  { id: "assets", icon: Image, label: "Image assets" },
  { id: "frontmatter", icon: FileCode2, label: "Frontmatter" },
];

export default function RightPanel() {
  const tab = useAppStore((s) => s.rightPanelTab);
  const setTab = useAppStore((s) => s.setRightPanelTab);
  const width = useAppStore((s) => s.rightPanelWidth);

  return (
    <div
      className="flex h-full shrink-0 flex-col border-l"
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
        aria-label="Right panel"
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
            <Icon size={14} />
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === "outline" && <TableOfContents />}
        {tab === "stats" && <DocumentStats />}
        {tab === "problems" && <ProblemsPanel />}
        {tab === "links" && <LinkCheckerPanel />}
        {tab === "assets" && <AssetManagerPanel />}
        {tab === "frontmatter" && <FrontmatterPanel />}
      </div>
    </div>
  );
}
