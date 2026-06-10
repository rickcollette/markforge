import { create } from "zustand";

import type { EditorMode, LintFinding } from "@/lib/types";

export type Toast = {
  id: number;
  kind: "info" | "success" | "error" | "warning";
  title: string;
  detail?: string;
};

export type DialogId =
  | "settings"
  | "export"
  | "about"
  | "shortcuts"
  | "command-palette"
  | "go-to-heading"
  | "snippets"
  | "templates"
  | "recovery"
  | "link"
  | "image"
  | "table"
  | null;

export type SidebarTab = "files" | "search" | "recent" | "diagrams";
export type RightPanelTab =
  | "outline"
  | "stats"
  | "problems"
  | "links"
  | "assets"
  | "frontmatter";

type AppState = {
  editorMode: EditorMode;
  sidebarVisible: boolean;
  rightPanelVisible: boolean;
  toolbarVisible: boolean;
  statusBarVisible: boolean;
  zenMode: boolean;
  typewriterMode: boolean;
  sidebarTab: SidebarTab;
  rightPanelTab: RightPanelTab;
  activeDialog: DialogId;
  uiZoom: number;
  /** Column sizes (px / ratio of the split container width). */
  sidebarWidth: number;
  rightPanelWidth: number;
  splitRatio: number;
  studioSplitRatio: number;
  toasts: Toast[];
  lintFindings: LintFinding[];
  /** When Mermaid Studio was opened from a block in a markdown doc. */
  studioContext: {
    documentId: string;
    blockIndex: number;
    source: string;
  } | null;
  studioSource: string;

  setEditorMode: (mode: EditorMode) => void;
  toggleSidebar: () => void;
  toggleRightPanel: () => void;
  toggleToolbar: () => void;
  toggleStatusBar: () => void;
  toggleZenMode: () => void;
  toggleTypewriterMode: () => void;
  setSidebarTab: (tab: SidebarTab) => void;
  setRightPanelTab: (tab: RightPanelTab) => void;
  setSidebarWidth: (width: number) => void;
  setRightPanelWidth: (width: number) => void;
  setSplitRatio: (ratio: number) => void;
  setStudioSplitRatio: (ratio: number) => void;
  openDialog: (dialog: DialogId) => void;
  closeDialog: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  toast: (toast: Omit<Toast, "id">) => void;
  dismissToast: (id: number) => void;
  setLintFindings: (findings: LintFinding[]) => void;
  setStudioContext: (ctx: AppState["studioContext"]) => void;
  setStudioSource: (source: string) => void;
};

let toastId = 0;

export const useAppStore = create<AppState>((set, get) => ({
  editorMode: "editor",
  sidebarVisible: true,
  rightPanelVisible: true,
  toolbarVisible: true,
  statusBarVisible: true,
  zenMode: false,
  typewriterMode: false,
  sidebarTab: "files",
  rightPanelTab: "outline",
  activeDialog: null,
  uiZoom: 1,
  sidebarWidth: 240,
  rightPanelWidth: 256,
  splitRatio: 0.5,
  studioSplitRatio: 0.5,
  toasts: [],
  lintFindings: [],
  studioContext: null,
  studioSource: "flowchart TD\n  A[Start] --> B[End]\n",

  setEditorMode: (editorMode) => set({ editorMode }),
  toggleSidebar: () => set((s) => ({ sidebarVisible: !s.sidebarVisible })),
  toggleRightPanel: () =>
    set((s) => ({ rightPanelVisible: !s.rightPanelVisible })),
  toggleToolbar: () => set((s) => ({ toolbarVisible: !s.toolbarVisible })),
  toggleStatusBar: () =>
    set((s) => ({ statusBarVisible: !s.statusBarVisible })),
  toggleZenMode: () => set((s) => ({ zenMode: !s.zenMode })),
  toggleTypewriterMode: () =>
    set((s) => ({ typewriterMode: !s.typewriterMode })),
  setSidebarTab: (sidebarTab) => set({ sidebarTab, sidebarVisible: true }),
  setRightPanelTab: (rightPanelTab) =>
    set({ rightPanelTab, rightPanelVisible: true }),
  setSidebarWidth: (width) =>
    set({ sidebarWidth: Math.min(520, Math.max(160, Math.round(width))) }),
  setRightPanelWidth: (width) =>
    set({ rightPanelWidth: Math.min(560, Math.max(180, Math.round(width))) }),
  setSplitRatio: (ratio) =>
    set({ splitRatio: Math.min(0.85, Math.max(0.15, ratio)) }),
  setStudioSplitRatio: (ratio) =>
    set({ studioSplitRatio: Math.min(0.85, Math.max(0.15, ratio)) }),
  openDialog: (activeDialog) => set({ activeDialog }),
  closeDialog: () => set({ activeDialog: null }),

  zoomIn: () => {
    const uiZoom = Math.min(2, get().uiZoom + 0.1);
    set({ uiZoom });
    document.documentElement.style.fontSize = `${16 * uiZoom}px`;
  },
  zoomOut: () => {
    const uiZoom = Math.max(0.6, get().uiZoom - 0.1);
    set({ uiZoom });
    document.documentElement.style.fontSize = `${16 * uiZoom}px`;
  },
  resetZoom: () => {
    set({ uiZoom: 1 });
    document.documentElement.style.fontSize = "16px";
  },

  toast: (toast) => {
    const id = ++toastId;
    set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }));
    const ttl = toast.kind === "error" ? 8000 : 4000;
    setTimeout(() => get().dismissToast(id), ttl);
  },
  dismissToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  setLintFindings: (lintFindings) => set({ lintFindings }),
  setStudioContext: (studioContext) => set({ studioContext }),
  setStudioSource: (studioSource) => set({ studioSource }),
}));

export function toastError(title: string, err: unknown) {
  const detail =
    typeof err === "object" && err !== null && "message" in err
      ? String((err as { message: unknown }).message)
      : String(err);
  useAppStore.getState().toast({ kind: "error", title, detail });
}
