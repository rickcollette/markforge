import { create } from "zustand";
import { getCurrentWindow } from "@tauri-apps/api/window";

import { DEFAULT_SETTINGS, type AppSettings } from "@/lib/types";
import * as backend from "@/lib/tauri/commands";

type SettingsState = {
  settings: AppSettings;
  loaded: boolean;
  load: () => Promise<void>;
  update: (patch: DeepPartial<AppSettings>) => void;
  replace: (settings: AppSettings) => void;
};

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

function deepMerge<T>(base: T, patch: DeepPartial<T>): T {
  const result: T = { ...base };
  for (const key of Object.keys(patch) as (keyof T)[]) {
    const value = patch[key];
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      typeof base[key] === "object" &&
      base[key] !== null
    ) {
      result[key] = deepMerge(base[key], value as DeepPartial<T[keyof T]>);
    } else if (value !== undefined) {
      result[key] = value as T[keyof T];
    }
  }
  return result;
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;

function persist(settings: AppSettings) {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    backend.saveSettings(settings).catch(() => {
      /* surfaced via toast elsewhere; settings persist is best-effort */
    });
  }, 300);
}

export function applyThemeToDom(settings: AppSettings) {
  const root = document.documentElement;
  const prefersDark =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark =
    settings.theme === "dark" || (settings.theme === "system" && prefersDark);
  root.classList.toggle("light", !dark);
  root.classList.toggle("dark", dark);
  root.dataset.density = settings.density;

  // Keep the native window chrome (title bar) in sync with the app theme.
  try {
    void getCurrentWindow()
      .setTheme(settings.theme === "system" ? null : settings.theme)
      .catch(() => {});
  } catch {
    /* not running inside Tauri */
  }
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,

  load: async () => {
    try {
      const settings = await backend.loadSettings();
      const merged = deepMerge(DEFAULT_SETTINGS, settings as never);
      set({ settings: merged, loaded: true });
      applyThemeToDom(merged);
    } catch {
      set({ loaded: true });
      applyThemeToDom(get().settings);
    }
  },

  update: (patch) => {
    const settings = deepMerge(get().settings, patch);
    set({ settings });
    applyThemeToDom(settings);
    persist(settings);
  },

  replace: (settings) => {
    set({ settings });
    applyThemeToDom(settings);
    persist(settings);
  },
}));

// Re-apply when the OS theme changes while in "system" mode.
if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", () => {
      applyThemeToDom(useSettingsStore.getState().settings);
    });
}
