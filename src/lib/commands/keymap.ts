// Central keyboard shortcut system. "mod" = Ctrl on Windows/Linux, Cmd on mac.
import { runCommand } from "./registry";

export const IS_MAC =
  typeof navigator !== "undefined" && /Mac/i.test(navigator.userAgent);

/** Default keymap: shortcut -> command id. Chords use a space. */
export const DEFAULT_KEYMAP: Record<string, string> = {
  "mod+n": "file.new",
  "mod+o": "file.open",
  "mod+k mod+o": "file.openFolder",
  "mod+s": "file.save",
  "mod+shift+s": "file.saveAs",
  "mod+alt+s": "file.saveAll",
  "mod+w": "file.close",
  "mod+shift+t": "tab.reopenClosed",
  "mod+tab": "tab.next",
  "ctrl+pagedown": "tab.next",
  "ctrl+pageup": "tab.previous",
  "mod+f": "edit.find",
  "mod+h": "edit.replace",
  "mod+shift+f": "edit.findInFiles",
  "mod+g": "edit.goToLine",
  "mod+shift+o": "edit.goToHeading",
  "mod+shift+p": "view.commandPalette",
  "mod+shift+v": "view.previewOnly",
  "mod+\\": "view.split",
  "mod+e": "view.editorOnly",
  "mod+alt+m": "view.mermaidStudio",
  "mod+b": "insert.bold",
  "mod+i": "insert.italic",
  "mod+k": "insert.link",
  "mod+shift+c": "insert.codeBlock",
  "mod+shift+k": "edit.deleteLine",
  "alt+up": "edit.moveLineUp",
  "alt+down": "edit.moveLineDown",
  "mod+/": "edit.toggleComment",
  "mod+d": "edit.duplicateLine",
  "f11": "view.zenMode",
  "mod+,": "file.preferences",
  "mod+=": "view.zoomIn",
  "mod+-": "view.zoomOut",
  "mod+0": "view.resetZoom",
};

export function shortcutForCommand(commandId: string): string | undefined {
  for (const [combo, id] of Object.entries(DEFAULT_KEYMAP)) {
    if (id === commandId) return formatShortcut(combo);
  }
  return undefined;
}

/** Human-readable platform-specific label, e.g. "Ctrl+Shift+P" / "⌘⇧P". */
export function formatShortcut(combo: string): string {
  return combo
    .split(" ")
    .map((part) =>
      part
        .split("+")
        .map((key) => {
          switch (key) {
            case "mod":
              return IS_MAC ? "⌘" : "Ctrl";
            case "shift":
              return IS_MAC ? "⇧" : "Shift";
            case "alt":
              return IS_MAC ? "⌥" : "Alt";
            case "ctrl":
              return IS_MAC ? "⌃" : "Ctrl";
            case "pageup":
              return "PgUp";
            case "pagedown":
              return "PgDn";
            default:
              return key.length === 1 ? key.toUpperCase() : capitalize(key);
          }
        })
        .join(IS_MAC ? "" : "+"),
    )
    .join(" ");
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function comboFromEvent(e: KeyboardEvent): string | null {
  const key = e.key.toLowerCase();
  if (["control", "shift", "alt", "meta"].includes(key)) return null;
  const parts: string[] = [];
  if (IS_MAC ? e.metaKey : e.ctrlKey) parts.push("mod");
  if (IS_MAC && e.ctrlKey) parts.push("ctrl");
  if (e.shiftKey) parts.push("shift");
  if (e.altKey) parts.push("alt");
  let normalized = key;
  if (key === "arrowup") normalized = "up";
  else if (key === "arrowdown") normalized = "down";
  else if (key === "arrowleft") normalized = "left";
  else if (key === "arrowright") normalized = "right";
  parts.push(normalized);
  return parts.join("+");
}

let pendingChord: string | null = null;
let chordTimer: ReturnType<typeof setTimeout> | null = null;

/** Global keydown handler. Returns true when the event was consumed. */
export function handleKeydown(e: KeyboardEvent): boolean {
  const combo = comboFromEvent(e);
  if (!combo) return false;

  if (pendingChord) {
    const full = `${pendingChord} ${combo}`;
    pendingChord = null;
    if (chordTimer) clearTimeout(chordTimer);
    const cmd = DEFAULT_KEYMAP[full];
    if (cmd) {
      e.preventDefault();
      e.stopPropagation();
      void runCommand(cmd);
      return true;
    }
    return false;
  }

  // Is this the start of any chord?
  const isChordStart = Object.keys(DEFAULT_KEYMAP).some((k) =>
    k.startsWith(`${combo} `),
  );
  if (isChordStart) {
    e.preventDefault();
    pendingChord = combo;
    chordTimer = setTimeout(() => {
      pendingChord = null;
    }, 2000);
    return true;
  }

  const commandId = DEFAULT_KEYMAP[combo];
  if (commandId) {
    e.preventDefault();
    e.stopPropagation();
    void runCommand(commandId);
    return true;
  }
  return false;
}
