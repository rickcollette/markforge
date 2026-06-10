import { chromium } from "@playwright/test";

const browser = await chromium.connectOverCDP("http://localhost:9222");
const page = browser
  .contexts()
  .flatMap((c) => c.pages())
  .find((p) => !p.url().startsWith("devtools"));

await page.reload();
await page.waitForTimeout(4000);

// Welcome screen with branding: close all tabs first via the File menu.
await page.evaluate(async () => {
  const { useDocumentStore } = await import("/src/state/documentStore.ts");
  const docs = useDocumentStore.getState();
  for (const d of [...docs.openDocuments]) {
    useDocumentStore.setState((s) => ({
      openDocuments: s.openDocuments.filter((x) => x.id !== d.id),
      activeDocumentId: null,
    }));
  }
});
await page.waitForTimeout(500);
await page.screenshot({ path: "e2e/shot-welcome.png" });

// Split view with a mermaid diagram.
await page.keyboard.press("Control+N");
await page.waitForTimeout(300);
await page
  .getByRole("menubar")
  .getByRole("button", { name: "Diagram", exact: true })
  .click();
await page.getByRole("menuitem", { name: "Insert Flowchart" }).click();
await page.getByRole("button", { name: /Split View/ }).click();
await page.waitForTimeout(2500);
await page.screenshot({ path: "e2e/shot-split.png" });

await browser.close();
process.exit(0);
