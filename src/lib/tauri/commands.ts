// Typed wrappers around every custom Rust command.
import { invoke } from "@tauri-apps/api/core";

import type {
  AppSettings,
  ExportResult,
  FileEntry,
  GitStatus,
  RecoverySnapshot,
  SearchResult,
  TextFileResponse,
  WorkspaceSettings,
  WorkspaceTree,
} from "../types";

// ---- files ----

export const allowPath = (path: string) =>
  invoke<string>("allow_path", { path });

export const readTextFile = (path: string) =>
  invoke<TextFileResponse>("read_text_file", { path });

export const writeTextFile = (path: string, content: string) =>
  invoke<void>("write_text_file", { path, content });

export const createFile = (path: string, content?: string) =>
  invoke<void>("create_file", { path, content: content ?? null });

export const createDirectory = (path: string) =>
  invoke<void>("create_directory", { path });

export const deleteFile = (path: string) =>
  invoke<void>("delete_file", { path });

export const renameFile = (oldPath: string, newPath: string) =>
  invoke<void>("rename_file", { oldPath, newPath });

export const duplicateFile = (path: string) =>
  invoke<string>("duplicate_file", { path });

export const copyFileInto = (source: string, destDir: string) =>
  invoke<string>("copy_file_into", { source, destDir });

export const listDirectory = (path: string) =>
  invoke<FileEntry[]>("list_directory", { path });

export const fileExists = (path: string) =>
  invoke<boolean>("file_exists", { path });

export const writeBinaryFile = (path: string, bytesBase64: string) =>
  invoke<void>("write_binary_file", { path, bytesBase64 });

export const readBinaryFile = (path: string) =>
  invoke<string>("read_binary_file", { path });

// ---- settings / app data ----

export const loadSettings = () => invoke<AppSettings>("load_settings");

export const saveSettings = (settings: AppSettings) =>
  invoke<void>("save_settings", { settings });

export const loadAppData = <T>(name: string) =>
  invoke<T | null>("load_app_data", { name });

export const saveAppData = (name: string, value: unknown) =>
  invoke<void>("save_app_data", { name, value });

// ---- workspace ----

export const openWorkspace = (path: string) =>
  invoke<WorkspaceTree>("open_workspace", { path });

export const readWorkspace = (path: string) =>
  invoke<WorkspaceTree>("read_workspace", { path });

export const watchWorkspace = (path: string) =>
  invoke<void>("watch_workspace", { path });

export const unwatchWorkspace = () => invoke<void>("unwatch_workspace");

export const loadWorkspaceSettings = (path: string) =>
  invoke<WorkspaceSettings>("load_workspace_settings", { path });

export const saveWorkspaceSettings = (
  path: string,
  settings: WorkspaceSettings,
) => invoke<void>("save_workspace_settings", { path, settings });

export const gitStatus = (path: string) =>
  invoke<GitStatus>("git_status", { path });

// ---- search ----

export const searchWorkspace = (
  workspacePath: string,
  query: string,
  fileGlob?: string,
) =>
  invoke<SearchResult[]>("search_workspace", {
    workspacePath,
    query,
    fileGlob: fileGlob ?? null,
  });

// ---- export ----

export type HtmlExportOptions = {
  title: string;
  inlineCss: string;
  includeToc: boolean;
  language: string;
};

export type DocxExportOptions = {
  title: string;
  diagramPngsBase64: (string | null)[];
};

export const exportMarkdownToHtml = (
  markdown: string,
  renderedHtml: string | null,
  options: HtmlExportOptions,
) =>
  invoke<ExportResult>("export_markdown_to_html", {
    markdown,
    renderedHtml,
    options,
  });

export const exportMarkdownToDocx = (
  markdown: string,
  options: DocxExportOptions,
) => invoke<ExportResult>("export_markdown_to_docx", { markdown, options });

export const saveExportedFile = (path: string, bytesBase64: string) =>
  invoke<void>("save_exported_file", { path, bytesBase64 });

// ---- recovery ----

export const saveRecoverySnapshot = (
  documentId: string,
  content: string,
  path: string | null,
  title: string | null,
) =>
  invoke<RecoverySnapshot>("save_recovery_snapshot", {
    documentId,
    content,
    path,
    title,
  });

export const listRecoverySnapshots = () =>
  invoke<RecoverySnapshot[]>("list_recovery_snapshots");

export const restoreRecoverySnapshot = (snapshotId: string) =>
  invoke<string>("restore_recovery_snapshot", { snapshotId });

export const deleteRecoverySnapshot = (snapshotId: string) =>
  invoke<void>("delete_recovery_snapshot", { snapshotId });

// ---- system ----

/** Files passed via file association / CLI on launch (drained once). */
export const takeStartupFiles = () => invoke<string[]>("take_startup_files");
