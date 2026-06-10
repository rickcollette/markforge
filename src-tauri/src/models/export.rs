use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct HtmlExportOptions {
    pub title: String,
    /// Full CSS text to embed inline; empty for unstyled export.
    pub inline_css: String,
    pub include_toc: bool,
    pub language: String,
}

impl Default for HtmlExportOptions {
    fn default() -> Self {
        Self {
            title: "Document".into(),
            inline_css: String::new(),
            include_toc: false,
            language: "en".into(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct DocxExportOptions {
    pub title: String,
    /// Mermaid diagrams pre-rendered to PNG by the frontend, keyed by the
    /// zero-based index of the mermaid code block in the document.
    pub diagram_pngs_base64: Vec<Option<String>>,
}

impl Default for DocxExportOptions {
    fn default() -> Self {
        Self {
            title: "Document".into(),
            diagram_pngs_base64: Vec::new(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportResult {
    pub suggested_filename: String,
    pub mime_type: String,
    pub bytes_base64: String,
}
