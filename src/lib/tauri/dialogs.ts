// Native dialog helpers. Every path returned by a dialog is registered
// with the Rust PathGuard before use.
import { open, save, confirm, message } from "@tauri-apps/plugin-dialog";

import { allowPath } from "./commands";

const MARKDOWN_FILTERS = [
  { name: "Markdown", extensions: ["md", "markdown", "mdown", "mkd"] },
  { name: "Mermaid", extensions: ["mmd", "mermaid"] },
  { name: "All Files", extensions: ["*"] },
];

export async function pickMarkdownFile(): Promise<string | null> {
  const selected = await open({
    multiple: false,
    directory: false,
    filters: MARKDOWN_FILTERS,
  });
  if (typeof selected !== "string") return null;
  return allowPath(selected);
}

export async function pickFolder(title?: string): Promise<string | null> {
  const selected = await open({ multiple: false, directory: true, title });
  if (typeof selected !== "string") return null;
  return allowPath(selected);
}

export async function pickImageFile(): Promise<string | null> {
  const selected = await open({
    multiple: false,
    directory: false,
    filters: [
      { name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "svg", "webp"] },
    ],
  });
  if (typeof selected !== "string") return null;
  return allowPath(selected);
}

export async function pickSavePath(
  defaultName: string,
  extension: string,
  filterName = "File",
): Promise<string | null> {
  const selected = await save({
    defaultPath: defaultName,
    filters: [{ name: filterName, extensions: [extension] }],
  });
  if (typeof selected !== "string") return null;
  return allowPath(selected);
}

export async function confirmDialog(
  text: string,
  title = "MarkForge",
): Promise<boolean> {
  return confirm(text, { title, kind: "warning" });
}

export async function messageDialog(
  text: string,
  title = "MarkForge",
): Promise<void> {
  await message(text, { title });
}
