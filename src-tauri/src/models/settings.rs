use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct EditorSettings {
    pub font_family: String,
    pub font_size: u32,
    pub line_height: f64,
    pub tab_size: u32,
    pub word_wrap: bool,
    pub minimap: bool,
    pub auto_save: bool,
    pub auto_save_delay_ms: u64,
}

impl Default for EditorSettings {
    fn default() -> Self {
        Self {
            font_family: "JetBrains Mono, Menlo, Consolas, monospace".into(),
            font_size: 14,
            line_height: 1.6,
            tab_size: 2,
            word_wrap: true,
            minimap: false,
            auto_save: true,
            auto_save_delay_ms: 750,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct PreviewSettings {
    pub theme: String,
    pub sync_scroll: bool,
    pub sanitize_html: bool,
}

impl Default for PreviewSettings {
    fn default() -> Self {
        Self {
            theme: "github".into(),
            sync_scroll: true,
            sanitize_html: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct MermaidSettings {
    pub theme: String,
    pub security_level: String,
    pub start_on_load: bool,
    pub html_labels: bool,
}

impl Default for MermaidSettings {
    fn default() -> Self {
        Self {
            theme: "default".into(),
            security_level: "strict".into(),
            start_on_load: false,
            html_labels: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ExportSettings {
    pub default_format: String,
    pub include_styles: bool,
    pub include_mermaid_diagrams: bool,
}

impl Default for ExportSettings {
    fn default() -> Self {
        Self {
            default_format: "pdf".into(),
            include_styles: true,
            include_mermaid_diagrams: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct FileSettings {
    pub restore_last_session: bool,
    pub confirm_before_delete: bool,
    pub create_backups: bool,
}

impl Default for FileSettings {
    fn default() -> Self {
        Self {
            restore_last_session: true,
            confirm_before_delete: true,
            create_backups: true,
        }
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AppSettings {
    pub theme: Theme,
    pub density: Density,
    pub editor: EditorSettings,
    pub preview: PreviewSettings,
    pub mermaid: MermaidSettings,
    pub export: ExportSettings,
    pub files: FileSettings,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Theme {
    #[default]
    System,
    Light,
    Dark,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Density {
    #[default]
    Comfortable,
    Compact,
    Dense,
}
