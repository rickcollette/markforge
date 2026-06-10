use std::path::Path;

use ignore::WalkBuilder;

use crate::models::errors::AppError;
use crate::models::workspace::SearchResult;

const MAX_RESULTS: usize = 1_000;
const MAX_FILE_SIZE: u64 = 10 * 1024 * 1024;
const PREVIEW_LEN: usize = 200;

fn glob_matches(name: &str, glob: &str) -> bool {
    // Minimal glob support: "*", "*.ext", "name.*", exact names and
    // comma-separated lists ("*.md,*.mmd").
    glob.split(',').map(str::trim).any(|g| {
        if g.is_empty() || g == "*" || g == "*.*" {
            return true;
        }
        if let Some(suffix) = g.strip_prefix('*') {
            return name.to_lowercase().ends_with(&suffix.to_lowercase());
        }
        if let Some(prefix) = g.strip_suffix('*') {
            return name.to_lowercase().starts_with(&prefix.to_lowercase());
        }
        name.eq_ignore_ascii_case(g)
    })
}

fn is_probably_text(name: &str) -> bool {
    const TEXT_EXTS: &[&str] = &[
        "md", "markdown", "mmd", "mermaid", "txt", "json", "yaml", "yml", "toml", "html", "css",
        "js", "ts", "tsx", "jsx", "rs", "py", "csv", "xml", "svg",
    ];
    Path::new(name)
        .extension()
        .map(|e| TEXT_EXTS.contains(&e.to_string_lossy().to_lowercase().as_str()))
        .unwrap_or(false)
}

pub fn search_workspace(
    workspace_path: &Path,
    query: &str,
    file_glob: Option<&str>,
) -> Result<Vec<SearchResult>, AppError> {
    if query.trim().is_empty() {
        return Ok(Vec::new());
    }
    let needle = query.to_lowercase();
    let mut results: Vec<SearchResult> = Vec::new();

    let walker = WalkBuilder::new(workspace_path)
        .hidden(false)
        .git_ignore(true)
        .follow_links(false)
        .filter_entry(|entry| {
            let name = entry.file_name().to_string_lossy();
            name != ".git" && name != "node_modules" && name != ".markforge"
        })
        .build();

    'outer: for entry in walker.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let name = path
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_default();
        if let Some(glob) = file_glob {
            if !glob_matches(&name, glob) {
                continue;
            }
        } else if !is_probably_text(&name) {
            continue;
        }
        if let Ok(meta) = path.metadata() {
            if meta.len() > MAX_FILE_SIZE {
                continue;
            }
        }
        let Ok(content) = std::fs::read_to_string(path) else {
            continue;
        };
        for (line_idx, line) in content.lines().enumerate() {
            let lower = line.to_lowercase();
            if let Some(col) = lower.find(&needle) {
                let preview: String = line.trim().chars().take(PREVIEW_LEN).collect();
                results.push(SearchResult {
                    path: path.to_string_lossy().into_owned(),
                    line: line_idx + 1,
                    column: col + 1,
                    preview,
                });
                if results.len() >= MAX_RESULTS {
                    break 'outer;
                }
            }
        }
    }
    Ok(results)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn temp_dir() -> PathBuf {
        let dir = std::env::temp_dir().join(format!("markforge-search-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn finds_case_insensitive_matches() {
        let dir = temp_dir();
        std::fs::write(dir.join("a.md"), "Hello World\nfoo BAR baz").unwrap();
        let results = search_workspace(&dir, "bar", None).unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].line, 2);
        assert_eq!(results[0].column, 5);
    }

    #[test]
    fn respects_glob_filter() {
        let dir = temp_dir();
        std::fs::write(dir.join("a.md"), "needle").unwrap();
        std::fs::write(dir.join("b.txt"), "needle").unwrap();
        let results = search_workspace(&dir, "needle", Some("*.md")).unwrap();
        assert_eq!(results.len(), 1);
        assert!(results[0].path.ends_with("a.md"));
    }

    #[test]
    fn empty_query_returns_nothing() {
        let dir = temp_dir();
        std::fs::write(dir.join("a.md"), "data").unwrap();
        assert!(search_workspace(&dir, "  ", None).unwrap().is_empty());
    }

    #[test]
    fn glob_matching_rules() {
        assert!(glob_matches("notes.md", "*.md"));
        assert!(!glob_matches("notes.txt", "*.md"));
        assert!(glob_matches("notes.txt", "*.md,*.txt"));
        assert!(glob_matches("anything.xyz", "*"));
    }
}
