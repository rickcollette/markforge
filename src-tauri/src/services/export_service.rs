use base64::Engine;
use docx_rs::{
    AlignmentType, Docx, Paragraph, Pic, Run, RunFonts, Table, TableCell, TableRow,
};
use pulldown_cmark::{CodeBlockKind, Event, HeadingLevel, Options, Parser, Tag, TagEnd};

use crate::models::errors::AppError;
use crate::models::export::{DocxExportOptions, ExportResult, HtmlExportOptions};

fn b64(bytes: &[u8]) -> String {
    base64::engine::general_purpose::STANDARD.encode(bytes)
}

pub fn decode_b64(data: &str) -> Result<Vec<u8>, AppError> {
    base64::engine::general_purpose::STANDARD
        .decode(data)
        .map_err(|e| AppError::Serialization(format!("Invalid base64 payload: {e}")))
}

pub fn slugify(input: &str) -> String {
    let mut slug = String::new();
    for c in input.chars() {
        if c.is_ascii_alphanumeric() {
            slug.push(c.to_ascii_lowercase());
        } else if (c == ' ' || c == '-' || c == '_') && !slug.ends_with('-') {
            slug.push('-');
        }
    }
    let slug = slug.trim_matches('-').to_string();
    if slug.is_empty() {
        "document".into()
    } else {
        slug
    }
}

// ---------------------------------------------------------------------------
// HTML export
// ---------------------------------------------------------------------------

fn escape_html(text: &str) -> String {
    text.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

/// Render markdown to an HTML body using pulldown-cmark. Used as the
/// fallback when the frontend does not supply pre-rendered HTML.
pub fn markdown_to_html_body(markdown: &str) -> String {
    let mut options = Options::empty();
    options.insert(Options::ENABLE_TABLES);
    options.insert(Options::ENABLE_FOOTNOTES);
    options.insert(Options::ENABLE_STRIKETHROUGH);
    options.insert(Options::ENABLE_TASKLISTS);
    options.insert(Options::ENABLE_HEADING_ATTRIBUTES);
    let parser = Parser::new_ext(markdown, options);
    let mut html = String::new();
    pulldown_cmark::html::push_html(&mut html, parser);
    html
}

pub fn export_html(
    markdown: &str,
    rendered_html: Option<&str>,
    options: &HtmlExportOptions,
) -> Result<ExportResult, AppError> {
    let body = match rendered_html {
        Some(html) if !html.trim().is_empty() => html.to_string(),
        _ => markdown_to_html_body(markdown),
    };
    let document = format!(
        "<!DOCTYPE html>\n<html lang=\"{lang}\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n<title>{title}</title>\n<style>\n{css}\n</style>\n</head>\n<body>\n<main class=\"markdown-body\">\n{body}\n</main>\n</body>\n</html>\n",
        lang = escape_html(&options.language),
        title = escape_html(&options.title),
        css = options.inline_css,
        body = body,
    );
    Ok(ExportResult {
        suggested_filename: format!("{}.html", slugify(&options.title)),
        mime_type: "text/html".into(),
        bytes_base64: b64(document.as_bytes()),
    })
}

// ---------------------------------------------------------------------------
// DOCX export (built-in, via docx-rs)
// ---------------------------------------------------------------------------

const FONT_MONO: &str = "Consolas";
const EMU_PER_PX: u32 = 9525;

fn heading_size(level: HeadingLevel) -> usize {
    // Half-points.
    match level {
        HeadingLevel::H1 => 48,
        HeadingLevel::H2 => 40,
        HeadingLevel::H3 => 34,
        HeadingLevel::H4 => 30,
        HeadingLevel::H5 => 26,
        HeadingLevel::H6 => 24,
    }
}

fn png_dimensions(bytes: &[u8]) -> Option<(u32, u32)> {
    // PNG: 8-byte signature, IHDR length+type (8 bytes), then width/height.
    if bytes.len() < 24 || &bytes[0..8] != b"\x89PNG\r\n\x1a\n" {
        return None;
    }
    let w = u32::from_be_bytes([bytes[16], bytes[17], bytes[18], bytes[19]]);
    let h = u32::from_be_bytes([bytes[20], bytes[21], bytes[22], bytes[23]]);
    if w == 0 || h == 0 {
        None
    } else {
        Some((w, h))
    }
}

#[derive(Clone, Default)]
struct InlineStyle {
    bold: bool,
    italic: bool,
    strike: bool,
    code: bool,
}

struct DocxBuilder {
    docx: Docx,
    /// Runs accumulated for the paragraph currently being built.
    runs: Vec<Run>,
    style_stack: Vec<InlineStyle>,
    list_stack: Vec<Option<u64>>,
    in_blockquote: bool,
    /// (is_mermaid, language) when inside a fenced code block.
    code_block: Option<String>,
    code_text: String,
    mermaid_index: usize,
    // Table assembly state.
    table_rows: Vec<Vec<String>>,
    current_row: Vec<String>,
    current_cell: String,
    in_table: bool,
}

impl DocxBuilder {
    fn new() -> Self {
        Self {
            docx: Docx::new(),
            runs: Vec::new(),
            style_stack: vec![InlineStyle::default()],
            list_stack: Vec::new(),
            in_blockquote: false,
            code_block: None,
            code_text: String::new(),
            mermaid_index: 0,
            table_rows: Vec::new(),
            current_row: Vec::new(),
            current_cell: String::new(),
            in_table: false,
        }
    }

    fn style(&self) -> InlineStyle {
        self.style_stack.last().cloned().unwrap_or_default()
    }

    fn push_text(&mut self, text: &str) {
        if self.in_table {
            self.current_cell.push_str(text);
            return;
        }
        if self.code_block.is_some() {
            self.code_text.push_str(text);
            return;
        }
        let style = self.style();
        let mut run = Run::new().add_text(text);
        if style.bold {
            run = run.bold();
        }
        if style.italic {
            run = run.italic();
        }
        if style.strike {
            run = run.strike();
        }
        if style.code {
            run = run
                .fonts(RunFonts::new().ascii(FONT_MONO))
                .color("c0392b");
        }
        if self.in_blockquote {
            run = run.italic().color("555555");
        }
        self.runs.push(run);
    }

    fn flush_paragraph(&mut self, heading: Option<HeadingLevel>) {
        if self.runs.is_empty() {
            return;
        }
        let runs = std::mem::take(&mut self.runs);
        let mut para = Paragraph::new();
        let indent = self.list_stack.len();
        if indent > 0 {
            para = para.indent(Some((indent as i32) * 360), None, None, None);
        }
        for mut run in runs {
            if let Some(level) = heading {
                run = run.size(heading_size(level)).bold();
            }
            para = para.add_run(run);
        }
        self.docx = std::mem::take(&mut self.docx).add_paragraph(para);
    }

    fn flush_code_block(&mut self, diagram_pngs: &[Option<String>]) {
        let lang = self.code_block.take().unwrap_or_default();
        let text = std::mem::take(&mut self.code_text);
        let is_mermaid = matches!(lang.as_str(), "mermaid" | "mmd" | "diagram")
            || lang.starts_with("mermaid-");

        if is_mermaid {
            let idx = self.mermaid_index;
            self.mermaid_index += 1;
            if let Some(Some(png_b64)) = diagram_pngs.get(idx) {
                if let Ok(bytes) = decode_b64(png_b64) {
                    if let Some((w, h)) = png_dimensions(&bytes) {
                        // Fit within ~6 inches of usable page width.
                        let max_w_px: u32 = 600;
                        let (w, h) = if w > max_w_px {
                            (max_w_px, (h as f64 * (max_w_px as f64 / w as f64)) as u32)
                        } else {
                            (w, h)
                        };
                        let pic = Pic::new(&bytes).size(w * EMU_PER_PX, h * EMU_PER_PX);
                        self.docx = std::mem::take(&mut self.docx).add_paragraph(
                            Paragraph::new()
                                .align(AlignmentType::Center)
                                .add_run(Run::new().add_image(pic)),
                        );
                        return;
                    }
                }
            }
        }

        for line in text.lines() {
            let run = Run::new()
                .add_text(line)
                .fonts(RunFonts::new().ascii(FONT_MONO))
                .size(18);
            self.docx = std::mem::take(&mut self.docx)
                .add_paragraph(Paragraph::new().add_run(run));
        }
    }

    fn flush_table(&mut self) {
        if self.table_rows.is_empty() {
            return;
        }
        let rows: Vec<TableRow> = self
            .table_rows
            .drain(..)
            .enumerate()
            .map(|(row_idx, cells)| {
                let cells: Vec<TableCell> = cells
                    .into_iter()
                    .map(|text| {
                        let mut run = Run::new().add_text(text);
                        if row_idx == 0 {
                            run = run.bold();
                        }
                        TableCell::new().add_paragraph(Paragraph::new().add_run(run))
                    })
                    .collect();
                TableRow::new(cells)
            })
            .collect();
        self.docx = std::mem::take(&mut self.docx).add_table(Table::new(rows));
    }
}

pub fn export_docx(markdown: &str, options: &DocxExportOptions) -> Result<ExportResult, AppError> {
    let mut md_options = Options::empty();
    md_options.insert(Options::ENABLE_TABLES);
    md_options.insert(Options::ENABLE_STRIKETHROUGH);
    md_options.insert(Options::ENABLE_TASKLISTS);
    let parser = Parser::new_ext(markdown, md_options);

    let mut b = DocxBuilder::new();
    let mut current_heading: Option<HeadingLevel> = None;

    for event in parser {
        match event {
            Event::Start(tag) => match tag {
                Tag::Heading { level, .. } => current_heading = Some(level),
                Tag::Emphasis => {
                    let mut s = b.style();
                    s.italic = true;
                    b.style_stack.push(s);
                }
                Tag::Strong => {
                    let mut s = b.style();
                    s.bold = true;
                    b.style_stack.push(s);
                }
                Tag::Strikethrough => {
                    let mut s = b.style();
                    s.strike = true;
                    b.style_stack.push(s);
                }
                Tag::CodeBlock(kind) => {
                    let lang = match kind {
                        CodeBlockKind::Fenced(lang) => lang.to_string(),
                        CodeBlockKind::Indented => String::new(),
                    };
                    b.code_block = Some(lang);
                }
                Tag::List(start) => b.list_stack.push(start),
                Tag::Item => {
                    let marker = match b.list_stack.last() {
                        Some(Some(_)) => "•  ".to_string(),
                        _ => "•  ".to_string(),
                    };
                    b.push_text(&marker);
                }
                Tag::BlockQuote(_) => b.in_blockquote = true,
                Tag::Table(_) => {
                    b.in_table = true;
                    b.table_rows.clear();
                }
                Tag::TableHead | Tag::TableRow => b.current_row = Vec::new(),
                Tag::TableCell => b.current_cell = String::new(),
                Tag::Link { dest_url, .. } => {
                    let _ = dest_url; // text content follows; URL appended on End
                    b.style_stack.push(b.style());
                }
                Tag::Image { dest_url, .. } => {
                    b.push_text(&format!("[image: {dest_url}]"));
                }
                _ => {}
            },
            Event::End(tag_end) => match tag_end {
                TagEnd::Heading(level) => {
                    b.flush_paragraph(Some(level));
                    current_heading = None;
                }
                TagEnd::Paragraph => {
                    if !b.in_table {
                        b.flush_paragraph(current_heading);
                    }
                }
                TagEnd::Emphasis | TagEnd::Strong | TagEnd::Strikethrough => {
                    b.style_stack.pop();
                }
                TagEnd::CodeBlock => b.flush_code_block(&options.diagram_pngs_base64),
                TagEnd::List(_) => {
                    b.list_stack.pop();
                }
                TagEnd::Item => b.flush_paragraph(None),
                TagEnd::BlockQuote(_) => {
                    b.flush_paragraph(None);
                    b.in_blockquote = false;
                }
                TagEnd::Table => {
                    b.flush_table();
                    b.in_table = false;
                }
                TagEnd::TableHead | TagEnd::TableRow => {
                    let row = std::mem::take(&mut b.current_row);
                    b.table_rows.push(row);
                }
                TagEnd::TableCell => {
                    let cell = std::mem::take(&mut b.current_cell);
                    b.current_row.push(cell);
                }
                TagEnd::Link => {
                    b.style_stack.pop();
                }
                _ => {}
            },
            Event::Text(text) => b.push_text(&text),
            Event::Code(code) => {
                let mut s = b.style();
                s.code = true;
                b.style_stack.push(s);
                b.push_text(&code);
                b.style_stack.pop();
            }
            Event::SoftBreak => b.push_text(" "),
            Event::HardBreak => {
                b.flush_paragraph(current_heading);
            }
            Event::Rule => {
                b.docx = std::mem::take(&mut b.docx).add_paragraph(
                    Paragraph::new()
                        .align(AlignmentType::Center)
                        .add_run(Run::new().add_text("⸻").color("888888")),
                );
            }
            Event::TaskListMarker(checked) => {
                b.push_text(if checked { "☑ " } else { "☐ " });
            }
            _ => {}
        }
    }
    b.flush_paragraph(None);

    let mut buf = std::io::Cursor::new(Vec::new());
    b.docx
        .build()
        .pack(&mut buf)
        .map_err(|e| AppError::ExportFailed(format!("DOCX packing failed: {e}")))?;

    Ok(ExportResult {
        suggested_filename: format!("{}.docx", slugify(&options.title)),
        mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            .into(),
        bytes_base64: b64(&buf.into_inner()),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn slugify_basics() {
        assert_eq!(slugify("My Great Doc!"), "my-great-doc");
        assert_eq!(slugify("  "), "document");
        assert_eq!(slugify("Hello---World"), "hello-world");
    }

    #[test]
    fn html_export_wraps_body() {
        let result = export_html(
            "# Title\n\nHello *world*",
            None,
            &HtmlExportOptions {
                title: "Test Doc".into(),
                inline_css: "body{color:red}".into(),
                ..Default::default()
            },
        )
        .unwrap();
        let html = String::from_utf8(decode_b64(&result.bytes_base64).unwrap()).unwrap();
        assert!(html.contains("<title>Test Doc</title>"));
        assert!(html.contains("body{color:red}"));
        assert!(html.contains("<h1>Title</h1>"));
        assert_eq!(result.suggested_filename, "test-doc.html");
    }

    #[test]
    fn html_export_prefers_rendered_html() {
        let result = export_html(
            "# ignored",
            Some("<p>pre-rendered</p>"),
            &HtmlExportOptions::default(),
        )
        .unwrap();
        let html = String::from_utf8(decode_b64(&result.bytes_base64).unwrap()).unwrap();
        assert!(html.contains("pre-rendered"));
        assert!(!html.contains("ignored"));
    }

    #[test]
    fn docx_export_produces_zip() {
        let result = export_docx(
            "# Title\n\nSome **bold** and `code`.\n\n- item one\n- item two\n\n| a | b |\n|---|---|\n| 1 | 2 |\n",
            &DocxExportOptions {
                title: "Doc".into(),
                ..Default::default()
            },
        )
        .unwrap();
        let bytes = decode_b64(&result.bytes_base64).unwrap();
        // DOCX is a ZIP container: PK magic.
        assert_eq!(&bytes[0..2], b"PK");
        assert_eq!(result.suggested_filename, "doc.docx");
    }

    #[test]
    fn png_dimension_parsing() {
        // Minimal valid PNG header for a 2x3 image.
        let mut bytes = b"\x89PNG\r\n\x1a\n".to_vec();
        bytes.extend_from_slice(&[0, 0, 0, 13]);
        bytes.extend_from_slice(b"IHDR");
        bytes.extend_from_slice(&2u32.to_be_bytes());
        bytes.extend_from_slice(&3u32.to_be_bytes());
        assert_eq!(png_dimensions(&bytes), Some((2, 3)));
        assert_eq!(png_dimensions(b"not a png"), None);
    }
}
