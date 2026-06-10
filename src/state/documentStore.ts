import { create } from "zustand";

import type { OpenDocument, RecentFile } from "@/lib/types";
import * as backend from "@/lib/tauri/commands";
import {
  confirmDialog,
  pickMarkdownFile,
  pickSavePath,
} from "@/lib/tauri/dialogs";
import { toastError } from "./appStore";
import { useSettingsStore } from "./settingsStore";

const MAX_RECENT = 20;
const MAX_CLOSED = 10;

type ClosedTab = {
  path: string | null;
  content: string;
  title: string;
};

type DocumentState = {
  openDocuments: OpenDocument[];
  activeDocumentId: string | null;
  recentFiles: RecentFile[];
  recentlyClosed: ClosedTab[];

  activeDocument: () => OpenDocument | null;
  newDocument: (content?: string, title?: string) => OpenDocument;
  openFileDialog: () => Promise<void>;
  openPath: (path: string, opts?: { allow?: boolean }) => Promise<void>;
  setContent: (id: string, content: string) => void;
  setCursor: (id: string, line: number, column: number) => void;
  setScrollTop: (id: string, scrollTop: number) => void;
  activate: (id: string) => void;
  save: (id?: string) => Promise<boolean>;
  saveAs: (id?: string) => Promise<boolean>;
  saveAll: () => Promise<void>;
  close: (id: string, opts?: { force?: boolean }) => Promise<boolean>;
  closeAll: () => Promise<boolean>;
  reopenClosed: () => Promise<void>;
  nextTab: () => void;
  previousTab: () => void;
  moveTab: (id: string, direction: -1 | 1) => void;
  loadRecents: () => Promise<void>;
  notePathRenamed: (oldPath: string, newPath: string) => void;
};

function nowIso() {
  return new Date().toISOString();
}

/** In-memory document content is always LF-normalized. */
function toLf(text: string) {
  return text.includes("\r") ? text.replace(/\r\n?/g, "\n") : text;
}

/** Restore the document's original line ending when writing to disk. */
function forDisk(doc: Pick<OpenDocument, "content" | "lineEnding">) {
  return doc.lineEnding === "crlf"
    ? doc.content.replace(/\n/g, "\r\n")
    : doc.content;
}

function titleFromPath(path: string) {
  const name = path.replace(/\\/g, "/").split("/").pop() ?? path;
  return name;
}

let untitledCounter = 0;
const autosaveTimers = new Map<string, ReturnType<typeof setTimeout>>();

function persistRecents(recentFiles: RecentFile[]) {
  backend.saveAppData("recent-files", recentFiles).catch(() => {});
}

export const useDocumentStore = create<DocumentState>((set, get) => {
  function scheduleAutosave(id: string) {
    const settings = useSettingsStore.getState().settings;
    const delay = Math.max(250, settings.editor.autoSaveDelayMs);
    const existing = autosaveTimers.get(id);
    if (existing) clearTimeout(existing);
    autosaveTimers.set(
      id,
      setTimeout(async () => {
        autosaveTimers.delete(id);
        const doc = get().openDocuments.find((d) => d.id === id);
        if (!doc || !doc.isDirty) return;
        const auto = useSettingsStore.getState().settings.editor.autoSave;
        if (doc.path && auto) {
          await get().save(id);
        } else {
          // New/unsaved files (or autosave off): crash-safe snapshot only.
          backend
            .saveRecoverySnapshot(doc.id, doc.content, doc.path, doc.title)
            .catch(() => {});
        }
      }, delay),
    );
  }

  function addRecent(path: string) {
    const recent: RecentFile = {
      path,
      title: titleFromPath(path),
      openedAt: nowIso(),
    };
    const recentFiles = [
      recent,
      ...get().recentFiles.filter((r) => r.path !== path),
    ].slice(0, MAX_RECENT);
    set({ recentFiles });
    persistRecents(recentFiles);
  }

  return {
    openDocuments: [],
    activeDocumentId: null,
    recentFiles: [],
    recentlyClosed: [],

    activeDocument: () => {
      const { openDocuments, activeDocumentId } = get();
      return openDocuments.find((d) => d.id === activeDocumentId) ?? null;
    },

    newDocument: (content = "", title) => {
      untitledCounter += 1;
      const doc: OpenDocument = {
        id: crypto.randomUUID(),
        path: null,
        title: title ?? `Untitled-${untitledCounter}`,
        content,
        originalContent: content,
        isDirty: content.length > 0,
        isNew: true,
        encoding: "utf-8",
        lineEnding: "lf",
        lastSavedAt: null,
        lastOpenedAt: nowIso(),
        cursorPosition: { line: 1, column: 1 },
        scrollTop: 0,
      };
      set((s) => ({
        openDocuments: [...s.openDocuments, doc],
        activeDocumentId: doc.id,
      }));
      return doc;
    },

    openFileDialog: async () => {
      try {
        const path = await pickMarkdownFile();
        if (!path) return;
        await get().openPath(path);
      } catch (err) {
        toastError("Could not open file", err);
      }
    },

    openPath: async (path, opts) => {
      try {
        if (opts?.allow) {
          path = await backend.allowPath(path);
        }
        const existing = get().openDocuments.find((d) => d.path === path);
        if (existing) {
          set({ activeDocumentId: existing.id });
          return;
        }
        const file = await backend.readTextFile(path);
        // In-memory content is always LF; the original ending is recorded
        // on the document and restored on save.
        const content = toLf(file.content);
        const doc: OpenDocument = {
          id: crypto.randomUUID(),
          path: file.path,
          title: titleFromPath(file.path),
          content,
          originalContent: content,
          isDirty: false,
          isNew: false,
          encoding: "utf-8",
          lineEnding: file.lineEnding === "crlf" ? "crlf" : "lf",
          lastSavedAt: file.modifiedAt,
          lastOpenedAt: nowIso(),
          cursorPosition: { line: 1, column: 1 },
          scrollTop: 0,
        };
        set((s) => ({
          openDocuments: [...s.openDocuments, doc],
          activeDocumentId: doc.id,
        }));
        addRecent(file.path);
      } catch (err) {
        toastError("Could not open file", err);
      }
    },

    setContent: (id, content) => {
      content = toLf(content);
      set((s) => ({
        openDocuments: s.openDocuments.map((d) =>
          d.id === id
            ? { ...d, content, isDirty: content !== d.originalContent }
            : d,
        ),
      }));
      scheduleAutosave(id);
    },

    setCursor: (id, line, column) => {
      set((s) => ({
        openDocuments: s.openDocuments.map((d) =>
          d.id === id ? { ...d, cursorPosition: { line, column } } : d,
        ),
      }));
    },

    setScrollTop: (id, scrollTop) => {
      set((s) => ({
        openDocuments: s.openDocuments.map((d) =>
          d.id === id ? { ...d, scrollTop } : d,
        ),
      }));
    },

    activate: (id) => set({ activeDocumentId: id }),

    save: async (id) => {
      const docId = id ?? get().activeDocumentId;
      const doc = get().openDocuments.find((d) => d.id === docId);
      if (!doc) return false;
      if (!doc.path) return get().saveAs(doc.id);
      try {
        await backend.writeTextFile(doc.path, forDisk(doc));
        set((s) => ({
          openDocuments: s.openDocuments.map((d) =>
            d.id === doc.id
              ? {
                  ...d,
                  originalContent: d.content,
                  isDirty: false,
                  isNew: false,
                  lastSavedAt: nowIso(),
                }
              : d,
          ),
        }));
        backend.deleteRecoverySnapshot(doc.id).catch(() => {});
        return true;
      } catch (err) {
        toastError("Could not save file", err);
        return false;
      }
    },

    saveAs: async (id) => {
      const docId = id ?? get().activeDocumentId;
      const doc = get().openDocuments.find((d) => d.id === docId);
      if (!doc) return false;
      try {
        const suggested = doc.path
          ? titleFromPath(doc.path)
          : doc.title.endsWith(".md")
            ? doc.title
            : `${doc.title}.md`;
        const path = await pickSavePath(suggested, "md", "Markdown");
        if (!path) return false;
        await backend.writeTextFile(path, forDisk(doc));
        set((s) => ({
          openDocuments: s.openDocuments.map((d) =>
            d.id === doc.id
              ? {
                  ...d,
                  path,
                  title: titleFromPath(path),
                  originalContent: d.content,
                  isDirty: false,
                  isNew: false,
                  lastSavedAt: nowIso(),
                }
              : d,
          ),
        }));
        backend.deleteRecoverySnapshot(doc.id).catch(() => {});
        addRecent(path);
        return true;
      } catch (err) {
        toastError("Could not save file", err);
        return false;
      }
    },

    saveAll: async () => {
      for (const doc of get().openDocuments) {
        if (doc.isDirty) await get().save(doc.id);
      }
    },

    close: async (id, opts) => {
      const doc = get().openDocuments.find((d) => d.id === id);
      if (!doc) return true;
      if (doc.isDirty && !opts?.force) {
        const ok = await confirmDialog(
          `"${doc.title}" has unsaved changes. Close without saving?`,
          "Unsaved Changes",
        );
        if (!ok) return false;
      }
      const timer = autosaveTimers.get(id);
      if (timer) clearTimeout(timer);
      autosaveTimers.delete(id);

      set((s) => {
        const idx = s.openDocuments.findIndex((d) => d.id === id);
        const openDocuments = s.openDocuments.filter((d) => d.id !== id);
        let activeDocumentId = s.activeDocumentId;
        if (activeDocumentId === id) {
          const neighbor =
            openDocuments[Math.min(idx, openDocuments.length - 1)];
          activeDocumentId = neighbor?.id ?? null;
        }
        const recentlyClosed = [
          { path: doc.path, content: doc.content, title: doc.title },
          ...s.recentlyClosed,
        ].slice(0, MAX_CLOSED);
        return { openDocuments, activeDocumentId, recentlyClosed };
      });
      if (!doc.isDirty) {
        backend.deleteRecoverySnapshot(doc.id).catch(() => {});
      }
      return true;
    },

    closeAll: async () => {
      for (const doc of [...get().openDocuments]) {
        const closed = await get().close(doc.id);
        if (!closed) return false;
      }
      return true;
    },

    reopenClosed: async () => {
      const [last, ...rest] = get().recentlyClosed;
      if (!last) return;
      set({ recentlyClosed: rest });
      if (last.path) {
        await get().openPath(last.path);
      } else {
        const doc = get().newDocument(last.content, last.title);
        useDocumentStore.getState().activate(doc.id);
      }
    },

    nextTab: () => {
      const { openDocuments, activeDocumentId } = get();
      if (openDocuments.length < 2) return;
      const idx = openDocuments.findIndex((d) => d.id === activeDocumentId);
      const next = openDocuments[(idx + 1) % openDocuments.length];
      set({ activeDocumentId: next.id });
    },

    previousTab: () => {
      const { openDocuments, activeDocumentId } = get();
      if (openDocuments.length < 2) return;
      const idx = openDocuments.findIndex((d) => d.id === activeDocumentId);
      const prev =
        openDocuments[(idx - 1 + openDocuments.length) % openDocuments.length];
      set({ activeDocumentId: prev.id });
    },

    moveTab: (id, direction) => {
      set((s) => {
        const idx = s.openDocuments.findIndex((d) => d.id === id);
        const target = idx + direction;
        if (idx < 0 || target < 0 || target >= s.openDocuments.length) {
          return s;
        }
        const openDocuments = [...s.openDocuments];
        const [doc] = openDocuments.splice(idx, 1);
        openDocuments.splice(target, 0, doc);
        return { ...s, openDocuments };
      });
    },

    loadRecents: async () => {
      try {
        const recents = await backend.loadAppData<RecentFile[]>("recent-files");
        if (Array.isArray(recents)) set({ recentFiles: recents });
      } catch {
        /* best-effort */
      }
    },

    notePathRenamed: (oldPath, newPath) => {
      set((s) => ({
        openDocuments: s.openDocuments.map((d) =>
          d.path === oldPath
            ? { ...d, path: newPath, title: titleFromPath(newPath) }
            : d,
        ),
      }));
    },
  };
});

/** Insert text into the active document at the current Monaco selection.
 * Registered by the editor component; falls back to append. */
export type EditorBridge = {
  insertText: (text: string) => void;
  wrapSelection: (before: string, after: string, placeholder?: string) => void;
  togglePrefix: (prefix: string) => void;
  replaceSelection: (
    transform: (selected: string) => string,
    fallbackWholeDoc?: boolean,
  ) => void;
  replaceRange: (
    startLine: number,
    endLine: number,
    text: string,
  ) => void;
  getSelection: () => string;
  focus: () => void;
  goToLine: (line: number, column?: number) => void;
  runEditorAction: (actionId: string) => void;
};

let bridge: EditorBridge | null = null;

export function registerEditorBridge(b: EditorBridge | null) {
  bridge = b;
}

export function editorBridge(): EditorBridge | null {
  return bridge;
}

export function useActiveDocument(): OpenDocument | null {
  return useDocumentStore((s) =>
    s.openDocuments.find((d) => d.id === s.activeDocumentId),
  ) ?? null;
}

// Notify app store consumers when documents change so panels can refresh.
export function documentWordStats(content: string) {
  const text = content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`~\-[\]()!|]/g, " ");
  const words = text.split(/\s+/).filter(Boolean).length;
  const chars = content.length;
  const readingMinutes = Math.max(1, Math.round(words / 220));
  return { words, chars, readingMinutes };
}
