import MenuBar from "./MenuBar";
import Toolbar from "./Toolbar";
import TabBar from "./TabBar";
import Sidebar from "./Sidebar";
import RightPanel from "./RightPanel";
import StatusBar from "./StatusBar";
import WelcomeScreen from "./WelcomeScreen";
import MarkdownEditor from "@/components/editor/MarkdownEditor";
import MermaidStudio from "@/components/mermaid/MermaidStudio";
import Toasts from "@/components/ui/Toasts";
import ResizeHandle from "@/components/ui/ResizeHandle";
import CommandPalette from "@/components/dialogs/CommandPalette";
import SettingsDialog from "@/components/dialogs/SettingsDialog";
import ExportDialog from "@/components/dialogs/ExportDialog";
import LinkDialog from "@/components/dialogs/LinkDialog";
import GoToHeadingDialog from "@/components/dialogs/GoToHeadingDialog";
import SnippetsDialog from "@/components/dialogs/SnippetsDialog";
import TemplatesDialog from "@/components/dialogs/TemplatesDialog";
import RecoveryDialog from "@/components/dialogs/RecoveryDialog";
import { AboutDialog, ShortcutsDialog } from "@/components/dialogs/HelpDialogs";

import { useAppStore } from "@/state/appStore";
import { useActiveDocument } from "@/state/documentStore";

export default function AppShell() {
  const {
    editorMode,
    sidebarVisible,
    rightPanelVisible,
    toolbarVisible,
    statusBarVisible,
    zenMode,
  } = useAppStore();
  const doc = useActiveDocument();

  const chromeHidden = zenMode;

  return (
    <div className="flex h-full flex-col">
      {!chromeHidden && <MenuBar />}
      {!chromeHidden && toolbarVisible && <Toolbar />}

      <div className="flex min-h-0 flex-1">
        {!chromeHidden && sidebarVisible && (
          <>
            <Sidebar />
            <ResizeHandle
              label="Resize sidebar"
              onDelta={(dx) => {
                const s = useAppStore.getState();
                s.setSidebarWidth(s.sidebarWidth + dx);
              }}
              onReset={() => useAppStore.getState().setSidebarWidth(240)}
            />
          </>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          {!chromeHidden && <TabBar />}
          <div className="min-h-0 flex-1">
            {editorMode === "mermaid-studio" ? (
              <MermaidStudio />
            ) : doc ? (
              <MarkdownEditor doc={doc} />
            ) : (
              <WelcomeScreen />
            )}
          </div>
        </div>

        {!chromeHidden &&
          rightPanelVisible &&
          editorMode !== "mermaid-studio" && (
            <>
              <ResizeHandle
                label="Resize right panel"
                onDelta={(dx) => {
                  const s = useAppStore.getState();
                  s.setRightPanelWidth(s.rightPanelWidth - dx);
                }}
                onReset={() => useAppStore.getState().setRightPanelWidth(256)}
              />
              <RightPanel />
            </>
          )}
      </div>

      {!chromeHidden && statusBarVisible && <StatusBar />}

      {/* Dialogs */}
      <CommandPalette />
      <SettingsDialog />
      <ExportDialog />
      <LinkDialog mode="link" />
      <LinkDialog mode="image" />
      <GoToHeadingDialog />
      <SnippetsDialog />
      <TemplatesDialog />
      <RecoveryDialog />
      <AboutDialog />
      <ShortcutsDialog />

      <Toasts />
    </div>
  );
}
