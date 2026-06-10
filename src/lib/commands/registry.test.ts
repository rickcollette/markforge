import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  allCommands,
  getCommand,
  isCommandEnabled,
  registerCommands,
  runCommand,
  searchCommands,
} from "./registry";

describe("command registry", () => {
  beforeEach(() => {
    registerCommands([
      {
        id: "test.alpha",
        title: "Alpha Action",
        category: "Test",
        keywords: ["first"],
        run: vi.fn(),
      },
      {
        id: "test.beta",
        title: "Beta Thing",
        category: "Test",
        keywords: ["second"],
        enabled: () => false,
        run: vi.fn(),
      },
    ]);
  });

  it("registers and retrieves commands", () => {
    expect(getCommand("test.alpha")?.title).toBe("Alpha Action");
    expect(allCommands().length).toBeGreaterThanOrEqual(2);
  });

  it("respects enabled predicates", () => {
    expect(isCommandEnabled("test.alpha")).toBe(true);
    expect(isCommandEnabled("test.beta")).toBe(false);
    expect(isCommandEnabled("test.missing")).toBe(false);
  });

  it("does not run disabled commands", async () => {
    const beta = getCommand("test.beta")!;
    await runCommand("test.beta");
    expect(beta.run).not.toHaveBeenCalled();
  });

  it("runs enabled commands", async () => {
    const alpha = getCommand("test.alpha")!;
    await runCommand("test.alpha");
    expect(alpha.run).toHaveBeenCalledOnce();
  });

  it("searches by title and keywords", () => {
    expect(searchCommands("alpha")[0].id).toBe("test.alpha");
    expect(searchCommands("second").some((c) => c.id === "test.beta")).toBe(
      true,
    );
    expect(searchCommands("zzz-no-match")).toHaveLength(0);
  });
});
