import type { CommandItem } from "../types";

const commands = new Map<string, CommandItem>();
const listeners = new Set<() => void>();

export function registerCommands(items: CommandItem[]) {
  for (const item of items) {
    commands.set(item.id, item);
  }
  listeners.forEach((l) => l());
}

export function getCommand(id: string): CommandItem | undefined {
  return commands.get(id);
}

export function allCommands(): CommandItem[] {
  return [...commands.values()];
}

export function isCommandEnabled(id: string): boolean {
  const cmd = commands.get(id);
  if (!cmd) return false;
  try {
    return cmd.enabled ? cmd.enabled() : true;
  } catch {
    return false;
  }
}

export async function runCommand(id: string): Promise<void> {
  const cmd = commands.get(id);
  if (!cmd) return;
  if (cmd.enabled && !cmd.enabled()) return;
  await cmd.run();
}

export function onRegistryChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Fuzzy-ish palette filter: every query token must appear in the haystack. */
export function searchCommands(query: string): CommandItem[] {
  const all = allCommands();
  const q = query.trim().toLowerCase();
  if (!q) return all;
  const tokens = q.split(/\s+/);
  return all
    .map((cmd) => {
      const haystack =
        `${cmd.title} ${cmd.category} ${cmd.keywords.join(" ")}`.toLowerCase();
      let score = 0;
      for (const token of tokens) {
        const idx = haystack.indexOf(token);
        if (idx === -1) return null;
        score += idx === 0 ? 3 : haystack[idx - 1] === " " ? 2 : 1;
      }
      if (cmd.title.toLowerCase().startsWith(q)) score += 5;
      return { cmd, score };
    })
    .filter((x): x is { cmd: CommandItem; score: number } => x !== null)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.cmd);
}
