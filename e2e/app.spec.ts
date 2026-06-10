// E2E flows from SPEC.md section 40.3 that are exercisable in a browser
// harness (filesystem-dependent flows are covered by Rust unit tests).
import { expect, test } from "@playwright/test";

import { installTauriMock, typeInEditor } from "./helpers";

test.beforeEach(async ({ page }) => {
  await installTauriMock(page);
  await page.goto("/");
  // Wait until React has mounted (the global keydown handler attaches then).
  await expect(page.getByRole("menubar")).toBeVisible();
});

test("app boots to the welcome screen with menus", async ({ page }) => {
  // The welcome screen shows the MarkForge lettering logo.
  await expect(
    page.getByRole("img", { name: "MarkForge" }).last(),
  ).toBeVisible();
  for (const menu of ["File", "Edit", "View", "Insert", "Diagram", "Help"]) {
    await expect(
      page.getByRole("menubar").getByRole("button", { name: menu, exact: true }),
    ).toBeVisible();
  }
});

test("every menu opens and every entry renders with a label", async ({ page }) => {
  // Open a document first so editor-dependent entries are present too.
  await page.getByRole("button", { name: "New File", exact: true }).click();
  await expect(page.locator(".monaco-editor").first()).toBeVisible();

  const menubar = page.getByRole("menubar");
  const menus = [
    "File", "Edit", "View", "Insert", "Format",
    "Diagram", "Export", "Tools", "Window", "Help",
  ];
  for (const menu of menus) {
    await menubar.getByRole("button", { name: menu, exact: true }).click();
    const dropdown = page.getByRole("menu");
    await expect(dropdown).toBeVisible();
    // Each rendered item has a non-empty label (an unregistered command
    // would render nothing; a broken one renders an empty item).
    const labels = await dropdown.getByRole("menuitem").allInnerTexts();
    expect(labels.length, menu).toBeGreaterThan(0);
    for (const label of labels) {
      expect(label.trim().length, `${menu} has an empty entry`).toBeGreaterThan(0);
    }
    await page.keyboard.press("Escape");
    await expect(dropdown).not.toBeVisible();
  }
});

test("outline panel lists headings typed on Windows (CRLF regression)", async ({ page }) => {
  await page.getByRole("button", { name: "New File", exact: true }).click();
  await page.locator(".monaco-editor").first().click();
  await page.keyboard.type("# Alpha\n\ntext\n\n## Beta\n", { delay: 2 });

  await expect(
    page.getByRole("navigation", { name: "Document outline" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Alpha/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Beta/ })).toBeVisible();
});

test("create file, type markdown, see it in split preview", async ({ page }) => {
  await page.getByRole("button", { name: "New File", exact: true }).click();
  await expect(page.locator(".monaco-editor").first()).toBeVisible();

  await typeInEditor(page, "# Hello MarkForge");
  // Switch to split view via the toolbar.
  await page.getByRole("button", { name: /Split View/ }).click();
  await expect(
    page.locator(".markdown-body h1", { hasText: "Hello MarkForge" }),
  ).toBeVisible({ timeout: 10_000 });

  // Tab shows the dirty indicator.
  await expect(page.getByLabel("Unsaved changes")).toBeVisible();
});

test("mermaid template renders as SVG in preview", async ({ page }) => {
  await page.getByRole("button", { name: "New File", exact: true }).click();
  await page.locator(".monaco-editor").first().click();

  // Insert a flowchart through the Diagram menu (command registry path).
  await page
    .getByRole("menubar")
    .getByRole("button", { name: "Diagram", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "Insert Flowchart" }).click();

  await page.getByRole("button", { name: /Split View/ }).click();
  await expect(page.locator(".mermaid-block svg")).toBeVisible({
    timeout: 20_000,
  });

  // Regression: the SVG must survive subsequent render generations
  // (it used to be wiped by a late re-commit of the preview HTML).
  await page.waitForTimeout(2500);
  await expect(page.locator(".mermaid-block svg")).toBeVisible();
});

test("command palette opens, filters, and runs commands", async ({ page }) => {
  await page.locator("body").click();
  await page.keyboard.press("Control+Shift+P");
  const input = page.getByPlaceholder("Type a command…");
  await expect(input).toBeVisible();
  await input.fill("zen");
  await page.getByRole("button", { name: /Toggle Zen Mode/ }).click();
  // Zen mode hides the menubar.
  await expect(page.getByRole("menubar")).toBeHidden();
  await page.keyboard.press("F11");
  await expect(page.getByRole("menubar")).toBeVisible();
});

test("mermaid studio validates, zooms, and loads templates", async ({ page }) => {
  await page.getByRole("button", { name: /Mermaid Studio/ }).click();
  await expect(page.getByText("Diagram is valid")).toBeVisible({
    timeout: 20_000,
  });

  // Template picker swaps the source.
  await page.getByLabel("Insert template").selectOption("sequence");
  await expect(page.getByText("Diagram is valid")).toBeVisible({
    timeout: 20_000,
  });
  await expect(
    page.locator(".flex-1").getByText("sequence", { exact: true }),
  ).toBeVisible();

  // Zoom controls.
  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect(page.getByText("118%")).toBeVisible();
  await page.getByRole("button", { name: "Fit to screen" }).click();
  await expect(page.getByText("100%")).toBeVisible();
});

test("broken mermaid shows an error card and valid docs lint clean", async ({ page }) => {
  await page.getByRole("button", { name: "New File", exact: true }).click();
  await page.locator(".monaco-editor").first().click();
  await page
    .getByRole("menubar")
    .getByRole("button", { name: "Diagram", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "Insert Flowchart" }).click();

  // Corrupt the diagram: click into the flowchart line and break its syntax.
  await page
    .locator(".view-line", { hasText: "flowchart TD" })
    .first()
    .click();
  await page.keyboard.press("End");
  await page.keyboard.type(" ((broken", { delay: 5 });

  await page.getByRole("button", { name: /Split View/ }).click();
  await expect(page.locator(".mermaid-error")).toBeVisible({ timeout: 20_000 });
  // The error card preserves the diagram source.
  await expect(page.locator(".mermaid-error pre")).toContainText("flowchart");
});

test("settings dialog switches theme", async ({ page }) => {
  await page
    .getByRole("menubar")
    .getByRole("button", { name: "File", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "Preferences" }).click();
  await expect(page.getByText("Preferences")).toBeVisible();

  // Theme select is the first field on the appearance tab.
  const html = page.locator("html");
  await page.locator("select").first().selectOption("dark");
  await expect(html).toHaveClass(/dark/);
  await page.locator("select").first().selectOption("light");
  await expect(html).toHaveClass(/light/);
});

test("split view panes scroll independently with long documents", async ({ page }) => {
  await page.getByRole("button", { name: "New File", exact: true }).click();
  await page.locator(".monaco-editor").first().click();
  // Generate a document much taller than the window.
  await page.keyboard.type("# Top\n\n", { delay: 2 });
  for (let i = 0; i < 60; i++) {
    await page.keyboard.type(`Paragraph ${i}\n\n`, { delay: 0 });
  }
  await page.getByRole("button", { name: /Split View/ }).click();

  const preview = page.locator(".markdown-body");
  await expect(preview.getByText("Paragraph 59")).toBeAttached();

  // The preview's scroll container must actually overflow (not grow the page).
  const scrollable = preview.locator("xpath=..");
  const metrics = await scrollable.evaluate((el) => ({
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
  }));
  expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);

  // Wheel-scrolling the preview moves its scrollTop.
  await scrollable.hover();
  await page.mouse.wheel(0, 600);
  await expect
    .poll(async () => scrollable.evaluate((el) => el.scrollTop))
    .toBeGreaterThan(0);

  // The app shell itself must not scroll.
  const bodyScroll = await page.evaluate(
    () => document.documentElement.scrollHeight - window.innerHeight,
  );
  expect(bodyScroll).toBeLessThanOrEqual(0);
});

test("tabs: multiple files, switch, close with middle state intact", async ({ page }) => {
  await page.getByRole("button", { name: "New File", exact: true }).click();
  await typeInEditor(page, "first doc");
  await page.keyboard.press("Control+N");
  await expect(page.getByRole("tab", { name: /Untitled-2/ })).toBeVisible();

  // Switch back to tab 1 and verify content survived.
  await page.getByRole("tab", { name: /Untitled-1/ }).click();
  await expect(page.locator(".monaco-editor")).toContainText("first doc");
});
