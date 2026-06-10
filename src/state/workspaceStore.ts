import { create } from "zustand";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

import type {
  FileEntry,
  GitStatus,
  RecentWorkspace,
  SearchResult,
  WorkspaceSettings,
} from "@/lib/types";
import * as backend from "@/lib/tauri/commands";
import { pickFolder } from "@/lib/tauri/dialogs";
import { toastError } from "./appStore";

const MAX_RECENT_WORKSPACES = 10;

type WorkspaceState = {
  workspacePath: string | null;
  workspaceName: string | null;
  entries: FileEntry[];
  workspaceSettings: WorkspaceSettings | null;
  git: GitStatus | null;
  recentWorkspaces: RecentWorkspace[];
  searchQuery: string;
  searchGlob: string;
  searchResults: SearchResult[];
  searching: boolean;

  openFolderDialog: () => Promise<void>;
  openWorkspacePath: (path: string) => Promise<void>;
  closeWorkspace: () => Promise<void>;
  refresh: () => Promise<void>;
  refreshGit: () => Promise<void>;
  search: (query: string, glob?: string) => Promise<void>;
  clearSearch: () => void;
  loadRecents: () => Promise<void>;
  saveWorkspaceSettings: (settings: WorkspaceSettings) => Promise<void>;
};

let unlistenWatcher: UnlistenFn | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

function persistRecents(recents: RecentWorkspace[]) {
  backend.saveAppData("recent-workspaces", recents).catch(() => {});
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspacePath: null,
  workspaceName: null,
  entries: [],
  workspaceSettings: null,
  git: null,
  recentWorkspaces: [],
  searchQuery: "",
  searchGlob: "",
  searchResults: [],
  searching: false,

  openFolderDialog: async () => {
    try {
      const path = await pickFolder("Open Workspace Folder");
      if (!path) return;
      await get().openWorkspacePath(path);
    } catch (err) {
      toastError("Could not open folder", err);
    }
  },

  openWorkspacePath: async (path) => {
    try {
      const tree = await backend.openWorkspace(path);
      const settings = await backend.loadWorkspaceSettings(tree.root);
      const name =
        settings.name || tree.root.replace(/\\/g, "/").split("/").pop() || "Workspace";
      set({
        workspacePath: tree.root,
        workspaceName: name,
        entries: tree.entries,
        workspaceSettings: settings,
        searchResults: [],
        searchQuery: "",
      });

      const recents: RecentWorkspace[] = [
        { path: tree.root, name, openedAt: new Date().toISOString() },
        ...get().recentWorkspaces.filter((r) => r.path !== tree.root),
      ].slice(0, MAX_RECENT_WORKSPACES);
      set({ recentWorkspaces: recents });
      persistRecents(recents);

      // Start watching for external changes.
      await backend.watchWorkspace(tree.root).catch(() => {});
      if (unlistenWatcher) unlistenWatcher();
      unlistenWatcher = await listen("workspace://changed", () => {
        if (refreshTimer) clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => {
          void get().refresh();
          void get().refreshGit();
        }, 600);
      });

      await get().refreshGit();
    } catch (err) {
      toastError("Could not open workspace", err);
    }
  },

  closeWorkspace: async () => {
    if (unlistenWatcher) {
      unlistenWatcher();
      unlistenWatcher = null;
    }
    await backend.unwatchWorkspace().catch(() => {});
    set({
      workspacePath: null,
      workspaceName: null,
      entries: [],
      workspaceSettings: null,
      git: null,
      searchResults: [],
      searchQuery: "",
    });
  },

  refresh: async () => {
    const path = get().workspacePath;
    if (!path) return;
    try {
      const tree = await backend.readWorkspace(path);
      set({ entries: tree.entries });
    } catch {
      /* transient errors during bulk file operations are fine */
    }
  },

  refreshGit: async () => {
    const path = get().workspacePath;
    if (!path) return;
    try {
      const git = await backend.gitStatus(path);
      set({ git });
    } catch {
      set({ git: null });
    }
  },

  search: async (query, glob) => {
    const path = get().workspacePath;
    if (!path) return;
    set({ searchQuery: query, searchGlob: glob ?? "", searching: true });
    try {
      const searchResults = await backend.searchWorkspace(
        path,
        query,
        glob || undefined,
      );
      set({ searchResults, searching: false });
    } catch (err) {
      set({ searching: false });
      toastError("Search failed", err);
    }
  },

  clearSearch: () =>
    set({ searchQuery: "", searchResults: [], searching: false }),

  loadRecents: async () => {
    try {
      const recents =
        await backend.loadAppData<RecentWorkspace[]>("recent-workspaces");
      if (Array.isArray(recents)) set({ recentWorkspaces: recents });
    } catch {
      /* best-effort */
    }
  },

  saveWorkspaceSettings: async (settings) => {
    const path = get().workspacePath;
    if (!path) return;
    try {
      await backend.saveWorkspaceSettings(path, settings);
      set({ workspaceSettings: settings, workspaceName: settings.name });
    } catch (err) {
      toastError("Could not save workspace settings", err);
    }
  },
}));
