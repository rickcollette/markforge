import { describe, expect, it } from "vitest";

import { MENUS, type MenuEntry } from "./menus";
import { registerAllCommands } from "./appCommands";
import { getCommand } from "./registry";

function collectCommandIds(entries: MenuEntry[], out: string[] = []): string[] {
  for (const entry of entries) {
    if (entry.type === "command") out.push(entry.id);
    if (entry.type === "submenu") collectCommandIds(entry.items, out);
  }
  return out;
}

describe("menu definitions", () => {
  it("every menu entry resolves to a registered command", () => {
    registerAllCommands();
    const ids = MENUS.flatMap((menu) => collectCommandIds(menu.items));
    expect(ids.length).toBeGreaterThan(80);

    const missing = ids.filter((id) => getCommand(id) === undefined);
    expect(missing).toEqual([]);
  });

  it("every registered command has a non-empty title and runner", () => {
    registerAllCommands();
    const ids = MENUS.flatMap((menu) => collectCommandIds(menu.items));
    for (const id of ids) {
      const command = getCommand(id)!;
      expect(command.title.length, id).toBeGreaterThan(0);
      expect(typeof command.run, id).toBe("function");
    }
  });
});
