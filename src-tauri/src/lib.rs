pub mod commands;
pub mod models;
pub mod security;
pub mod services;

use std::path::{Path, PathBuf};
use std::sync::Mutex;

use tauri::{Emitter, Manager};

use security::path_guard::PathGuard;
use services::workspace_service::WorkspaceWatcher;

/// Files passed on the command line (file associations / "Open with…").
/// The frontend drains this once on boot via `take_startup_files`.
#[derive(Default)]
pub struct StartupFiles(pub Mutex<Vec<String>>);

/// Filter command-line arguments down to existing files, resolve them
/// against `cwd`, and grant them in the path guard.
fn collect_file_args(args: &[String], cwd: &Path, guard: &PathGuard) -> Vec<String> {
    args.iter()
        .skip(1) // executable path
        .filter(|a| !a.starts_with('-'))
        .map(|a| {
            let p = Path::new(a);
            if p.is_absolute() {
                p.to_path_buf()
            } else {
                cwd.join(p)
            }
        })
        .filter(|p| p.is_file())
        .filter_map(|p| guard.allow(&p.to_string_lossy()).ok())
        .map(|p| p.display().to_string())
        .collect()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        // Forward files from secondary launches (e.g. double-clicking a
        // markdown file while MarkForge is running) to the existing window.
        .plugin(tauri_plugin_single_instance::init(|app, argv, cwd| {
            let guard = app.state::<PathGuard>();
            let files = collect_file_args(&argv, Path::new(&cwd), &guard);
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
            if !files.is_empty() {
                let _ = app.emit_to("main", "app://open-files", files);
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(PathGuard::default())
        .manage(WorkspaceWatcher::default())
        .manage(StartupFiles::default())
        .setup(|app| {
            // Files passed to the first launch.
            let args: Vec<String> = std::env::args().collect();
            let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
            let guard = app.state::<PathGuard>();
            let files = collect_file_args(&args, &cwd, &guard);
            *app.state::<StartupFiles>().0.lock().unwrap() = files;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // files
            commands::files::allow_path,
            commands::files::read_text_file,
            commands::files::write_text_file,
            commands::files::create_file,
            commands::files::create_directory,
            commands::files::delete_file,
            commands::files::rename_file,
            commands::files::duplicate_file,
            commands::files::copy_file_into,
            commands::files::list_directory,
            commands::files::file_exists,
            commands::files::write_binary_file,
            commands::files::read_binary_file,
            // settings
            commands::settings::load_settings,
            commands::settings::save_settings,
            commands::settings::load_app_data,
            commands::settings::save_app_data,
            // workspace
            commands::workspace::open_workspace,
            commands::workspace::read_workspace,
            commands::workspace::watch_workspace,
            commands::workspace::unwatch_workspace,
            commands::workspace::load_workspace_settings,
            commands::workspace::save_workspace_settings,
            commands::workspace::git_status,
            // search
            commands::search::search_workspace,
            // export
            commands::export::export_markdown_to_html,
            commands::export::export_markdown_to_docx,
            commands::export::save_exported_file,
            // system
            commands::system::toggle_devtools,
            commands::system::app_version,
            commands::system::take_startup_files,
            // recovery
            commands::recovery::save_recovery_snapshot,
            commands::recovery::list_recovery_snapshots,
            commands::recovery::restore_recovery_snapshot,
            commands::recovery::delete_recovery_snapshot,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app_handle, event| {
        // macOS delivers file-association opens as Opened events instead of
        // command-line arguments.
        #[cfg(target_os = "macos")]
        if let tauri::RunEvent::Opened { urls } = &event {
            let guard = app_handle.state::<PathGuard>();
            let files: Vec<String> = urls
                .iter()
                .filter_map(|u| u.to_file_path().ok())
                .filter_map(|p| guard.allow(&p.to_string_lossy()).ok())
                .map(|p| p.display().to_string())
                .collect();
            if !files.is_empty() {
                // Queue for boot in case the frontend isn't ready yet, and
                // emit for the running app. The frontend drains the queue
                // exactly once, so files are never opened twice.
                app_handle
                    .state::<StartupFiles>()
                    .0
                    .lock()
                    .unwrap()
                    .extend(files.clone());
                let _ = app_handle.emit_to("main", "app://open-files", files);
            }
        }
        let _ = (&app_handle, &event);
    });
}
