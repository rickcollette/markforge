// Session persistence and restore (SPEC.md section 30).
import * as backend from "./tauri/commands";
import { useDocumentStore } from "@/state/documentStore";
import { useWorkspaceStore } from "@/state/workspaceStore";
import { useAppStore } from "@/state/appStore";
import type { EditorMode } from "./types";

type SessionData = {
  workspacePath: string | null;
  openFiles: { path: string; line: number; column: number }[];
  activePath: string | null;
  layout: {
    editorMode: EditorMode;
    sidebarVisible: boolean;
    rightPanelVisible: boolean;
    toolbarVisible: boolean;
    statusBarVisible: boolean;
    sidebarWidth?: number;
    rightPanelWidth?: number;
    splitRatio?: number;
  };
};

function snapshot(): SessionData {
  const docs = useDocumentStore.getState();
  const ws = useWorkspaceStore.getState();
  const app = useAppStore.getState();
  const active = docs.openDocuments.find((d) => d.id === docs.activeDocumentId);
  return {
    workspacePath: ws.workspacePath,
    openFiles: docs.openDocuments
      .filter((d) => d.path)
      .map((d) => ({
        path: d.path!,
        line: d.cursorPosition.line,
        column: d.cursorPosition.column,
      })),
    activePath: active?.path ?? null,
    layout: {
      editorMode: app.editorMode === "mermaid-studio" ? "editor" : app.editorMode,
      sidebarVisible: app.sidebarVisible,
      rightPanelVisible: app.rightPanelVisible,
      toolbarVisible: app.toolbarVisible,
      statusBarVisible: app.statusBarVisible,
      sidebarWidth: app.sidebarWidth,
      rightPanelWidth: app.rightPanelWidth,
      splitRatio: app.splitRatio,
    },
  };
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    backend.saveAppData("session", snapshot()).catch(() => {});
  }, 1000);
}

/** Start persisting session state whenever stores change. */
export function startSessionPersistence() {
  useDocumentStore.subscribe(scheduleSave);
  useWorkspaceStore.subscribe(scheduleSave);
  useAppStore.subscribe((state, prev) => {
    if (
      state.editorMode !== prev.editorMode ||
      state.sidebarVisible !== prev.sidebarVisible ||
      state.rightPanelVisible !== prev.rightPanelVisible ||
      state.toolbarVisible !== prev.toolbarVisible ||
      state.statusBarVisible !== prev.statusBarVisible ||
      state.sidebarWidth !== prev.sidebarWidth ||
      state.rightPanelWidth !== prev.rightPanelWidth ||
      state.splitRatio !== prev.splitRatio
    ) {
      scheduleSave();
    }
  });
}

/** Restore the previous session (workspace, tabs, cursors, layout). */
export async function restoreSession(): Promise<void> {
  const session = await backend.loadAppData<SessionData>("session");
  if (!session) return;

  const app = useAppStore.getState();
  if (session.layout) {
    app.setEditorMode(session.layout.editorMode ?? "editor");
    if (session.layout.sidebarVisible === false) app.toggleSidebar();
    if (session.layout.rightPanelVisible === false) app.toggleRightPanel();
    if (session.layout.toolbarVisible === false) app.toggleToolbar();
    if (session.layout.statusBarVisible === false) app.toggleStatusBar();
    if (session.layout.sidebarWidth) app.setSidebarWidth(session.layout.sidebarWidth);
    if (session.layout.rightPanelWidth)
      app.setRightPanelWidth(session.layout.rightPanelWidth);
    if (session.layout.splitRatio) app.setSplitRatio(session.layout.splitRatio);
  }

  if (session.workspacePath) {
    try {
      await backend.allowPath(session.workspacePath);
      await useWorkspaceStore
        .getState()
        .openWorkspacePath(session.workspacePath);
    } catch {
      /* workspace may have been deleted */
    }
  }

  const docs = useDocumentStore.getState();
  for (const file of session.openFiles ?? []) {
    try {
      await backend.allowPath(file.path);
      await docs.openPath(file.path);
      const opened = useDocumentStore
        .getState()
        .openDocuments.find((d) => d.path === file.path);
      if (opened) {
        useDocumentStore.getState().setCursor(opened.id, file.line, file.column);
      }
    } catch {
      /* file may have been deleted */
    }
  }

  if (session.activePath) {
    const active = useDocumentStore
      .getState()
      .openDocuments.find((d) => d.path === session.activePath);
    if (active) useDocumentStore.getState().activate(active.id);
  }
}
