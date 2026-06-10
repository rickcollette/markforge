// Registers every application command. The registry is the single source
// of truth for menus, the toolbar, the command palette and shortcuts.
import { getCurrentWindow } from "@tauri-apps/api/window";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { openUrl, revealItemInDir } from "@tauri-apps/plugin-opener";
import { invoke } from "@tauri-apps/api/core";

import type { CommandItem } from "../types";
import { registerCommands } from "./registry";
import { shortcutForCommand } from "./keymap";
import {
  editorBridge,
  useDocumentStore,
} from "@/state/documentStore";
import { useAppStore, toastError } from "@/state/appStore";
import { useWorkspaceStore } from "@/state/workspaceStore";
import { useSettingsStore } from "@/state/settingsStore";
import {
  calloutTemplate,
  cleanMarkdown,
  convertSpacesToTabs,
  convertTabsToSpaces,
  convertToTable,
  convertToTaskList,
  DEFAULT_TABLE,
  fixMermaidIndentation,
  formatAllTables,
  normalizeHeadings,
  renumberOrderedLists,
  sortLines,
  trimTrailingWhitespace,
  unwrapParagraph,
  wrapParagraph,
} from "../markdown/markdownFormatter";
import { MERMAID_TEMPLATES, asFencedBlock } from "../mermaid/mermaidTemplates";
import { checkForUpdates } from "../updater";

function cmd(
  id: string,
  title: string,
  category: string,
  run: () => void | Promise<void>,
  options: Partial<Pick<CommandItem, "keywords" | "enabled">> = {},
): CommandItem {
  return {
    id,
    title,
    category,
    keywords: options.keywords ?? [],
    shortcut: shortcutForCommand(id),
    enabled: options.enabled,
    run,
  };
}

const docs = () => useDocumentStore.getState();
const app = () => useAppStore.getState();
const ws = () => useWorkspaceStore.getState();

const hasActiveDoc = () => docs().activeDocument() !== null;
const hasEditor = () =>
  hasActiveDoc() &&
  app().editorMode !== "mermaid-studio" &&
  editorBridge() !== null;

function withBridge(fn: (b: NonNullable<ReturnType<typeof editorBridge>>) => void) {
  const b = editorBridge();
  if (b) fn(b);
}

function insertBlock(text: string) {
  withBridge((b) => {
    b.insertText(`\n${text}\n`);
    b.focus();
  });
}

export function registerAllCommands() {
  const items: CommandItem[] = [
    // ---------------- File ----------------
    cmd("file.new", "New File", "File", () => void docs().newDocument(), {
      keywords: ["create", "untitled"],
    }),
    cmd("file.newFromTemplate", "New From Template", "File", () =>
      app().openDialog("templates"),
    ),
    cmd("file.newWindow", "New Window", "File", async () => {
      try {
        new WebviewWindow(`main-${Date.now()}`, {
          url: "/",
          title: "MarkForge",
          width: 1280,
          height: 860,
        });
      } catch (err) {
        toastError("Could not open window", err);
      }
    }),
    cmd("file.open", "Open File", "File", () => docs().openFileDialog(), {
      keywords: ["browse"],
    }),
    cmd("file.openFolder", "Open Folder / Workspace", "File", () =>
      ws().openFolderDialog(),
    ),
    cmd("file.save", "Save", "File", () => void docs().save(), {
      enabled: hasActiveDoc,
    }),
    cmd("file.saveAs", "Save As", "File", () => void docs().saveAs(), {
      enabled: hasActiveDoc,
    }),
    cmd("file.saveAll", "Save All", "File", () => docs().saveAll(), {
      enabled: () => docs().openDocuments.some((d) => d.isDirty),
    }),
    cmd(
      "file.duplicate",
      "Duplicate File",
      "File",
      async () => {
        const doc = docs().activeDocument();
        if (!doc?.path) return;
        try {
          const copy = await invoke<string>("duplicate_file", {
            path: doc.path,
          });
          await docs().openPath(copy);
          void ws().refresh();
        } catch (err) {
          toastError("Could not duplicate file", err);
        }
      },
      { enabled: () => Boolean(docs().activeDocument()?.path) },
    ),
    cmd(
      "file.revealInFileManager",
      "Reveal in File Manager",
      "File",
      async () => {
        const path = docs().activeDocument()?.path;
        if (!path) return;
        try {
          await revealItemInDir(path);
        } catch (err) {
          toastError("Could not reveal file", err);
        }
      },
      { enabled: () => Boolean(docs().activeDocument()?.path) },
    ),
    cmd(
      "file.close",
      "Close File",
      "File",
      () => {
        const id = docs().activeDocumentId;
        if (id) void docs().close(id);
      },
      { enabled: hasActiveDoc },
    ),
    cmd(
      "file.closeWorkspace",
      "Close Workspace",
      "File",
      () => void ws().closeWorkspace(),
      { enabled: () => ws().workspacePath !== null },
    ),
    cmd("file.export", "Export…", "File", () => app().openDialog("export"), {
      enabled: hasActiveDoc,
      keywords: ["pdf", "html", "docx"],
    }),
    cmd("file.print", "Print", "File", () => window.print(), {
      enabled: hasActiveDoc,
    }),
    cmd("file.preferences", "Preferences", "File", () =>
      app().openDialog("settings"),     { keywords: ["settings", "options"] }),
    cmd("file.exit", "Exit", "File", async () => {
      const closed = await docs().closeAll();
      if (closed) await getCurrentWindow().close();
    }),

    // ---------------- Edit ----------------
    cmd("edit.undo", "Undo", "Edit", () => withBridge((b) => b.runEditorAction("undo")), {
      enabled: hasEditor,
    }),
    cmd("edit.redo", "Redo", "Edit", () => withBridge((b) => b.runEditorAction("redo")), {
      enabled: hasEditor,
    }),
    cmd(
      "edit.cut",
      "Cut",
      "Edit",
      () => withBridge((b) => b.runEditorAction("editor.action.clipboardCutAction")),
      { enabled: hasEditor },
    ),
    cmd(
      "edit.copy",
      "Copy",
      "Edit",
      () => withBridge((b) => b.runEditorAction("editor.action.clipboardCopyAction")),
      { enabled: hasEditor },
    ),
    cmd(
      "edit.paste",
      "Paste",
      "Edit",
      async () => {
        try {
          const text = await navigator.clipboard.readText();
          withBridge((b) => b.insertText(text));
        } catch {
          withBridge((b) => b.runEditorAction("editor.action.clipboardPasteAction"));
        }
      },
      { enabled: hasEditor },
    ),
    cmd(
      "edit.pastePlain",
      "Paste as Plain Text",
      "Edit",
      async () => {
        try {
          const text = await navigator.clipboard.readText();
          withBridge((b) => b.insertText(text));
        } catch (err) {
          toastError("Clipboard unavailable", err);
        }
      },
      { enabled: hasEditor },
    ),
    cmd(
      "edit.selectAll",
      "Select All",
      "Edit",
      () => withBridge((b) => b.runEditorAction("editor.action.selectAll")),
      { enabled: hasEditor },
    ),
    cmd("edit.find", "Find", "Edit", () => withBridge((b) => b.runEditorAction("actions.find")), {
      enabled: hasEditor,
    }),
    cmd(
      "edit.replace",
      "Replace",
      "Edit",
      () =>
        withBridge((b) =>
          b.runEditorAction("editor.action.startFindReplaceAction"),
        ),
      { enabled: hasEditor },
    ),
    cmd(
      "edit.findInFiles",
      "Find in Files",
      "Edit",
      () => app().setSidebarTab("search"),
      { enabled: () => ws().workspacePath !== null },
    ),
    cmd(
      "edit.goToLine",
      "Go to Line",
      "Edit",
      () => withBridge((b) => b.runEditorAction("editor.action.gotoLine")),
      { enabled: hasEditor },
    ),
    cmd("edit.goToHeading", "Go to Heading", "Edit", () =>
      app().openDialog("go-to-heading"),     { enabled: hasActiveDoc }),
    cmd(
      "edit.toggleComment",
      "Toggle Comment",
      "Edit",
      () => withBridge((b) => b.runEditorAction("editor.action.commentLine")),
      { enabled: hasEditor },
    ),
    cmd(
      "edit.duplicateLine",
      "Duplicate Line",
      "Edit",
      () =>
        withBridge((b) => b.runEditorAction("editor.action.copyLinesDownAction")),
      { enabled: hasEditor },
    ),
    cmd(
      "edit.deleteLine",
      "Delete Line",
      "Edit",
      () => withBridge((b) => b.runEditorAction("editor.action.deleteLines")),
      { enabled: hasEditor },
    ),
    cmd(
      "edit.moveLineUp",
      "Move Line Up",
      "Edit",
      () => withBridge((b) => b.runEditorAction("editor.action.moveLinesUpAction")),
      { enabled: hasEditor },
    ),
    cmd(
      "edit.moveLineDown",
      "Move Line Down",
      "Edit",
      () =>
        withBridge((b) => b.runEditorAction("editor.action.moveLinesDownAction")),
      { enabled: hasEditor },
    ),
    cmd(
      "edit.sortLines",
      "Sort Selected Lines",
      "Edit",
      () => withBridge((b) => b.replaceSelection(sortLines)),
      { enabled: hasEditor },
    ),
    cmd(
      "edit.trimWhitespace",
      "Trim Trailing Whitespace",
      "Edit",
      () => withBridge((b) => b.replaceSelection(trimTrailingWhitespace, true)),
      { enabled: hasEditor },
    ),
    cmd(
      "edit.tabsToSpaces",
      "Convert Tabs to Spaces",
      "Edit",
      () =>
        withBridge((b) =>
          b.replaceSelection(
            (t) =>
              convertTabsToSpaces(
                t,
                useSettingsStore.getState().settings.editor.tabSize,
              ),
            true,
          ),
        ),
      { enabled: hasEditor },
    ),
    cmd(
      "edit.spacesToTabs",
      "Convert Spaces to Tabs",
      "Edit",
      () =>
        withBridge((b) =>
          b.replaceSelection(
            (t) =>
              convertSpacesToTabs(
                t,
                useSettingsStore.getState().settings.editor.tabSize,
              ),
            true,
          ),
        ),
      { enabled: hasEditor },
    ),

    // ---------------- View ----------------
    cmd("view.editorOnly", "Editor Only", "View", () =>
      app().setEditorMode("editor"),
    ),
    cmd("view.split", "Split View", "View", () => app().setEditorMode("split")),
    cmd("view.previewOnly", "Preview Only", "View", () =>
      app().setEditorMode("preview"),
    ),
    cmd("view.mermaidStudio", "Mermaid Studio", "View", () =>
      app().setEditorMode("mermaid-studio"),     { keywords: ["diagram"] }),
    cmd("view.toggleSidebar", "Toggle Sidebar", "View", () =>
      app().toggleSidebar(),
    ),
    cmd("view.toggleRightPanel", "Toggle Right Panel", "View", () =>
      app().toggleRightPanel(),
    ),
    cmd("view.toggleToolbar", "Toggle Toolbar", "View", () =>
      app().toggleToolbar(),
    ),
    cmd("view.toggleStatusBar", "Toggle Status Bar", "View", () =>
      app().toggleStatusBar(),
    ),
    cmd("view.zenMode", "Toggle Zen Mode", "View", () => app().toggleZenMode(), {
      keywords: ["focus", "distraction"],
    }),
    cmd("view.typewriterMode", "Toggle Typewriter Mode", "View", () =>
      app().toggleTypewriterMode(),
    ),
    cmd("view.toggleWordWrap", "Toggle Word Wrap", "View", () => {
      const s = useSettingsStore.getState();
      s.update({ editor: { wordWrap: !s.settings.editor.wordWrap } });
    }),
    cmd("view.toggleMinimap", "Toggle Minimap", "View", () => {
      const s = useSettingsStore.getState();
      s.update({ editor: { minimap: !s.settings.editor.minimap } });
    }),
    cmd("view.zoomIn", "Zoom In", "View", () => app().zoomIn()),
    cmd("view.zoomOut", "Zoom Out", "View", () => app().zoomOut()),
    cmd("view.resetZoom", "Reset Zoom", "View", () => app().resetZoom()),
    cmd("view.toggleTheme", "Toggle Dark Mode", "View", () => {
      const s = useSettingsStore.getState();
      const isDark = document.documentElement.classList.contains("dark");
      s.update({ theme: isDark ? "light" : "dark" });
    }),
    cmd("view.themeLight", "Theme: Light", "View", () =>
      useSettingsStore.getState().update({ theme: "light" }),
    ),
    cmd("view.themeDark", "Theme: Dark", "View", () =>
      useSettingsStore.getState().update({ theme: "dark" }),
    ),
    cmd("view.themeSystem", "Theme: System", "View", () =>
      useSettingsStore.getState().update({ theme: "system" }),
    ),
    cmd("view.commandPalette", "Command Palette", "View", () =>
      app().openDialog("command-palette"),
    ),

    // ---------------- Insert ----------------
    cmd("insert.h1", "Heading 1", "Insert", () => withBridge((b) => b.togglePrefix("# ")), {
      enabled: hasEditor,
    }),
    cmd("insert.h2", "Heading 2", "Insert", () => withBridge((b) => b.togglePrefix("## ")), {
      enabled: hasEditor,
    }),
    cmd("insert.h3", "Heading 3", "Insert", () => withBridge((b) => b.togglePrefix("### ")), {
      enabled: hasEditor,
    }),
    cmd("insert.bold", "Bold", "Insert", () =>
      withBridge((b) => b.wrapSelection("**", "**", "bold text")),     { enabled: hasEditor }),
    cmd("insert.italic", "Italic", "Insert", () =>
      withBridge((b) => b.wrapSelection("*", "*", "italic text")),     { enabled: hasEditor }),
    cmd("insert.strikethrough", "Strikethrough", "Insert", () =>
      withBridge((b) => b.wrapSelection("~~", "~~", "text")),     { enabled: hasEditor }),
    cmd("insert.inlineCode", "Inline Code", "Insert", () =>
      withBridge((b) => b.wrapSelection("`", "`", "code")),     { enabled: hasEditor }),
    cmd("insert.codeBlock", "Code Block", "Insert", () =>
      withBridge((b) => b.wrapSelection("\n```\n", "\n```\n", "code")),     { enabled: hasEditor }),
    cmd("insert.blockquote", "Blockquote", "Insert", () =>
      withBridge((b) => b.togglePrefix("> ")),     { enabled: hasEditor }),
    cmd("insert.orderedList", "Ordered List", "Insert", () =>
      withBridge((b) => b.togglePrefix("1. ")),     { enabled: hasEditor }),
    cmd("insert.unorderedList", "Unordered List", "Insert", () =>
      withBridge((b) => b.togglePrefix("- ")),     { enabled: hasEditor }),
    cmd("insert.taskList", "Task List", "Insert", () =>
      withBridge((b) => b.togglePrefix("- [ ] ")),     { enabled: hasEditor }),
    cmd("insert.link", "Link", "Insert", () => app().openDialog("link"), {
      enabled: hasEditor,
    }),
    cmd("insert.image", "Image", "Insert", () => app().openDialog("image"), {
      enabled: hasEditor,
    }),
    cmd("insert.table", "Table", "Insert", () => insertBlock(DEFAULT_TABLE), {
      enabled: hasEditor,
    }),
    cmd("insert.hr", "Horizontal Rule", "Insert", () => insertBlock("---"), {
      enabled: hasEditor,
    }),
    cmd("insert.footnote", "Footnote", "Insert", () =>
      withBridge((b) => {
        b.insertText("[^1]");
        b.insertText("\n\n[^1]: Footnote text.\n");
      }),     { enabled: hasEditor }),
    ...["NOTE", "TIP", "IMPORTANT", "WARNING", "CAUTION"].map((type) =>
      cmd(
        `insert.callout${type}`,
        `Callout: ${type.charAt(0) + type.slice(1).toLowerCase()}`,
        "Insert",
        () => insertBlock(calloutTemplate(type)),
        { enabled: hasEditor, keywords: ["admonition", "alert"] },
      ),
    ),
    cmd("insert.mermaid", "Mermaid Diagram", "Insert", () =>
      insertBlock(asFencedBlock("flowchart TD\n  A[Start] --> B[End]")),     { enabled: hasEditor }),
    cmd("insert.date", "Date", "Insert", () =>
      withBridge((b) => b.insertText(new Date().toISOString().slice(0, 10))),     { enabled: hasEditor }),
    cmd("insert.time", "Time", "Insert", () =>
      withBridge((b) =>
        b.insertText(new Date().toTimeString().slice(0, 5)),
      ),     { enabled: hasEditor }),
    cmd("insert.frontmatter", "Frontmatter Block", "Insert", () =>
      withBridge((b) =>
        b.insertText('---\ntitle: \ndescription: \ntags: []\ndraft: true\n---\n'),
      ),     { enabled: hasEditor }),
    cmd("insert.htmlBlock", "HTML Block", "Insert", () =>
      insertBlock("<div>\n\n</div>"),     { enabled: hasEditor }),
    cmd("insert.snippet", "Insert Snippet…", "Insert", () =>
      app().openDialog("snippets"),     { enabled: hasEditor }),

    // ---------------- Format ----------------
    cmd(
      "format.document",
      "Format Document",
      "Format",
      () => withBridge((b) => b.replaceSelection(cleanMarkdown, true)),
      { enabled: hasEditor },
    ),
    cmd(
      "format.selection",
      "Format Selection",
      "Format",
      () => withBridge((b) => b.replaceSelection(cleanMarkdown)),
      { enabled: hasEditor },
    ),
    cmd(
      "format.normalizeHeadings",
      "Normalize Headings",
      "Format",
      () => withBridge((b) => b.replaceSelection(normalizeHeadings, true)),
      { enabled: hasEditor },
    ),
    cmd(
      "format.renumberLists",
      "Renumber Ordered Lists",
      "Format",
      () => withBridge((b) => b.replaceSelection(renumberOrderedLists, true)),
      { enabled: hasEditor },
    ),
    cmd(
      "format.toTable",
      "Convert Selection to Table",
      "Format",
      () => withBridge((b) => b.replaceSelection(convertToTable)),
      { enabled: hasEditor },
    ),
    cmd(
      "format.toTaskList",
      "Convert Selection to Task List",
      "Format",
      () => withBridge((b) => b.replaceSelection(convertToTaskList)),
      { enabled: hasEditor },
    ),
    cmd(
      "format.wrapParagraph",
      "Wrap Paragraph",
      "Format",
      () => withBridge((b) => b.replaceSelection((t) => wrapParagraph(t, 80))),
      { enabled: hasEditor },
    ),
    cmd(
      "format.unwrapParagraph",
      "Unwrap Paragraph",
      "Format",
      () => withBridge((b) => b.replaceSelection(unwrapParagraph)),
      { enabled: hasEditor },
    ),
    cmd(
      "format.cleanMarkdown",
      "Clean Markdown",
      "Format",
      () => withBridge((b) => b.replaceSelection(cleanMarkdown, true)),
      { enabled: hasEditor },
    ),
    cmd(
      "format.fixTables",
      "Fix Markdown Tables",
      "Format",
      () => withBridge((b) => b.replaceSelection(formatAllTables, true)),
      { enabled: hasEditor },
    ),
    cmd(
      "format.fixMermaidIndentation",
      "Fix Mermaid Block Indentation",
      "Format",
      () => withBridge((b) => b.replaceSelection(fixMermaidIndentation, true)),
      { enabled: hasEditor },
    ),

    // ---------------- Diagram ----------------
    cmd("diagram.new", "New Mermaid Diagram", "Diagram", () => {
      app().setStudioContext(null);
      app().setStudioSource("flowchart TD\n  A[Start] --> B[End]\n");
      app().setEditorMode("mermaid-studio");
    }),
    ...MERMAID_TEMPLATES.map((t) =>
      cmd(
        `diagram.insert.${t.id}`,
        `Insert ${t.name}`,
        "Diagram",
        () => insertBlock(asFencedBlock(t.source)),
        { enabled: hasEditor, keywords: ["mermaid", t.type] },
      ),
    ),
    cmd("diagram.openStudio", "Open in Mermaid Studio", "Diagram", () =>
      app().setEditorMode("mermaid-studio"),
    ),

    // ---------------- Tools ----------------
    cmd("tools.commandPalette", "Command Palette", "Tools", () =>
      app().openDialog("command-palette"),
    ),
    cmd("tools.linter", "Markdown Linter", "Tools", () =>
      app().setRightPanelTab("problems"),     { enabled: hasActiveDoc }),
    cmd("tools.linkChecker", "Link Checker", "Tools", () =>
      app().setRightPanelTab("links"),     { enabled: hasActiveDoc }),
    cmd("tools.wordCount", "Word Count & Stats", "Tools", () =>
      app().setRightPanelTab("stats"),     { enabled: hasActiveDoc }),
    cmd("tools.assetManager", "Image Asset Manager", "Tools", () =>
      app().setRightPanelTab("assets"),     { enabled: hasActiveDoc }),
    cmd("tools.frontmatterEditor", "Frontmatter Editor", "Tools", () =>
      app().setRightPanelTab("frontmatter"),     { enabled: hasActiveDoc }),
    cmd("tools.snippetManager", "Snippet Manager", "Tools", () =>
      app().openDialog("snippets"),
    ),
    cmd("tools.templateManager", "Template Manager", "Tools", () =>
      app().openDialog("templates"),
    ),
    cmd("tools.backupManager", "Backup Manager", "Tools", () =>
      app().openDialog("recovery"),     { keywords: ["recovery", "snapshot"] }),
    cmd("tools.devtools", "Developer Tools", "Tools", async () => {
      try {
        await invoke("toggle_devtools");
      } catch {
        /* only available in dev builds */
      }
    }),

    // ---------------- Window ----------------
    cmd("window.minimize", "Minimize", "Window", () =>
      getCurrentWindow().minimize(),
    ),
    cmd("window.maximize", "Maximize", "Window", async () => {
      const win = getCurrentWindow();
      if (await win.isMaximized()) {
        await win.unmaximize();
      } else {
        await win.maximize();
      }
    }),
    cmd("window.fullscreen", "Fullscreen", "Window", async () => {
      const win = getCurrentWindow();
      await win.setFullscreen(!(await win.isFullscreen()));
    }),
    cmd("tab.next", "Next Tab", "Window", () => docs().nextTab(), {
      enabled: () => docs().openDocuments.length > 1,
    }),
    cmd("tab.previous", "Previous Tab", "Window", () => docs().previousTab(), {
      enabled: () => docs().openDocuments.length > 1,
    }),
    cmd(
      "tab.moveLeft",
      "Move Tab Left",
      "Window",
      () => {
        const id = docs().activeDocumentId;
        if (id) docs().moveTab(id, -1);
      },
      { enabled: () => docs().openDocuments.length > 1 },
    ),
    cmd(
      "tab.moveRight",
      "Move Tab Right",
      "Window",
      () => {
        const id = docs().activeDocumentId;
        if (id) docs().moveTab(id, 1);
      },
      { enabled: () => docs().openDocuments.length > 1 },
    ),
    cmd(
      "tab.close",
      "Close Tab",
      "Window",
      () => {
        const id = docs().activeDocumentId;
        if (id) void docs().close(id);
      },
      { enabled: hasActiveDoc },
    ),
    cmd(
      "tab.reopenClosed",
      "Reopen Closed Tab",
      "Window",
      () => docs().reopenClosed(),
      { enabled: () => docs().recentlyClosed.length > 0 },
    ),

    // ---------------- Help ----------------
    cmd("help.docs", "MarkForge Help", "Help", () =>
      app().openDialog("about"),
    ),
    cmd("help.markdownGuide", "Markdown Guide", "Help", () =>
      openUrl("https://commonmark.org/help/"),
    ),
    cmd("help.mermaidGuide", "Mermaid Guide", "Help", () =>
      openUrl("https://mermaid.js.org/intro/"),
    ),
    cmd("help.shortcuts", "Keyboard Shortcuts", "Help", () =>
      app().openDialog("shortcuts"),
    ),
    cmd("help.reportIssue", "Report Issue", "Help", () =>
      openUrl("https://github.com/rickcollette/markforge/issues/new"),
    ),
    cmd(
      "help.checkUpdates",
      "Check for Updates…",
      "Help",
      () => void checkForUpdates(),
      { keywords: ["upgrade", "update", "version"] },
    ),
    cmd("help.about", "About MarkForge", "Help", () =>
      app().openDialog("about"),
    ),
  ];

  registerCommands(items);
}
