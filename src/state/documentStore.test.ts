import { beforeEach, describe, expect, it } from "vitest";

import { documentWordStats, useDocumentStore } from "./documentStore";

describe("documentStore", () => {
  beforeEach(() => {
    useDocumentStore.setState({
      openDocuments: [],
      activeDocumentId: null,
      recentFiles: [],
      recentlyClosed: [],
    });
  });

  it("creates new untitled documents and activates them", () => {
    const doc = useDocumentStore.getState().newDocument();
    const state = useDocumentStore.getState();
    expect(state.openDocuments).toHaveLength(1);
    expect(state.activeDocumentId).toBe(doc.id);
    expect(doc.isNew).toBe(true);
    expect(doc.isDirty).toBe(false);
  });

  it("tracks dirty state from content changes", () => {
    const doc = useDocumentStore.getState().newDocument("orig");
    useDocumentStore.getState().setContent(doc.id, "changed");
    expect(useDocumentStore.getState().openDocuments[0].isDirty).toBe(true);
    useDocumentStore.getState().setContent(doc.id, "orig");
    expect(useDocumentStore.getState().openDocuments[0].isDirty).toBe(false);
  });

  it("cycles tabs forward and backward", () => {
    const s = useDocumentStore.getState();
    const a = s.newDocument("", "a");
    const b = s.newDocument("", "b");
    const c = s.newDocument("", "c");
    expect(useDocumentStore.getState().activeDocumentId).toBe(c.id);
    useDocumentStore.getState().nextTab();
    expect(useDocumentStore.getState().activeDocumentId).toBe(a.id);
    useDocumentStore.getState().previousTab();
    expect(useDocumentStore.getState().activeDocumentId).toBe(c.id);
    expect(b.id).toBeTruthy();
  });

  it("closes clean documents and tracks recently closed", async () => {
    const s = useDocumentStore.getState();
    const doc = s.newDocument("", "x");
    const closed = await useDocumentStore.getState().close(doc.id);
    expect(closed).toBe(true);
    const state = useDocumentStore.getState();
    expect(state.openDocuments).toHaveLength(0);
    expect(state.recentlyClosed[0].title).toBe("x");
  });

  it("moves tabs", () => {
    const s = useDocumentStore.getState();
    const a = s.newDocument("", "a");
    s.newDocument("", "b");
    useDocumentStore.getState().moveTab(a.id, 1);
    expect(useDocumentStore.getState().openDocuments[1].id).toBe(a.id);
  });
});

describe("documentWordStats", () => {
  it("counts words ignoring markdown syntax and fences", () => {
    const stats = documentWordStats("# Title\n\nsome words here\n\n```\ncode\n```");
    expect(stats.words).toBe(4); // Title + some + words + here
    expect(stats.readingMinutes).toBeGreaterThanOrEqual(1);
  });
});
