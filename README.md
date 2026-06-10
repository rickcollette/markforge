# MarkForge

A fast, native desktop Markdown editor with first-class [Mermaid](https://mermaid.js.org/) diagram support, built with Tauri 2, Rust, React, and TypeScript.

Website: [markforge.rickcollette.org](https://markforge.rickcollette.org/) · Repository: [rickcollette/markforge](https://github.com/rickcollette/markforge)

## Features

- **Markdown editing** — Monaco-based editor with syntax highlighting (including highlighting inside ```` ```mermaid ```` fences), multi-cursor, find/replace, snippets, and Markdown-aware list continuation.
- **Live preview** — sanitized markdown-it pipeline with callouts, task lists, footnotes, TOC, six preview themes, and bidirectional scroll sync in split view.
- **Mermaid Studio** — dedicated diagram mode with 9 templates, live validation, zoom/pan preview, theme selection, and SVG/PNG export or copy.
- **Inline diagrams** — every Mermaid fence renders independently with a content-hash cache; a broken diagram shows an error card, never a broken preview.
- **Workspace mode** — folder tree (`.gitignore`-aware), full-text search, file operations, read-only Git status, and session restore.
- **Export** — HTML (self-contained, inlined diagram SVGs), PDF (print stylesheet), DOCX (built-in Rust generator), plain text, cleaned Markdown, Reveal.js slides, and batch diagram export.
- **Quality tooling** — Markdown linter with Monaco markers and a Problems panel, link checker, asset manager, frontmatter editor, autosave with crash-recovery snapshots.
- **Command-driven UI** — every menu item, toolbar button, and shortcut runs through one command registry, searchable from the command palette (`Ctrl+Shift+P`).

## Development

Prerequisites: Node 20+, Rust 1.80+, and the [Tauri prerequisites](https://tauri.app/start/prerequisites/) for your platform.

```bash
npm install
npm run tauri:dev      # run the desktop app in dev mode
```

## Testing

```bash
npm run test:run       # Vitest unit tests (frontend)
cargo test             # Rust unit tests (run inside src-tauri/)
npm run test:e2e       # Playwright E2E suite (runs against the Vite dev server)
npm run lint           # ESLint
```

## Building

```bash
npm run tauri:build    # produce platform installers (NSIS/MSI on Windows, dmg on macOS, AppImage/deb on Linux)
```

## Releasing

`VERSION` is the single source of truth; release scripts bump it and sync
`tauri.conf.json`, `package.json`, and `Cargo.toml` automatically.

One command does everything — build all targets, sign update artifacts,
write the update manifest, refresh the website, verify, and publish:

```powershell
./scripts/release.ps1 -Notes "What changed" -Publish -PushPages
```

Individual steps (all in `scripts/`):

| Script | Purpose |
| --- | --- |
| `bump-version.ps1 [major\|minor\|patch] [-Set x.y.z]` | bump + sync version everywhere |
| `build-windows-package.ps1 [-NoBump]` | NSIS installer (self-contained) |
| `build-linux-packages.ps1 [-NoBump] [-Target ubuntu-24.04\|debian-12]` | debs + AppImage via Docker |
| `make-update-manifest.ps1 -Notes "..."` | sign artifacts, write `docs/latest.json` |
| `update-website.ps1` | sync download links/version on the Pages site |
| `publish-release.ps1 [-PushPages]` | create GitHub release, upload assets (needs `gh`) |
| `verify-updater.ps1 [-Online]` | end-to-end consistency checks for the updater |

In-app updates (Help → Check for Updates) verify artifacts against the
minisign public key in `tauri.conf.json`; the private key lives in
`%USERPROFILE%\.tauri\markforge.key` and must never be committed. Windows
installer and Linux AppImage builds self-update; `.deb` installs update via
a manual download (or `apt`).

## Architecture

- `src/` — React frontend: Zustand stores (`state/`), command registry and keymap (`lib/commands/`), markdown + mermaid pipelines (`lib/markdown/`, `lib/mermaid/`), UI (`components/`).
- `src-tauri/src/` — Rust backend: `commands/` (IPC surface), `services/` (file, workspace, search, export, recovery, settings), `security/path_guard.rs` (all filesystem access is validated against explicitly user-granted paths), `models/` (shared types).

See `SPEC.md` for the full product specification.

## License

MIT — © 2026 Rick Collette ([megalith@root.sh](mailto:megalith@root.sh)) · GitHub: [@rickcollette](https://github.com/rickcollette)
