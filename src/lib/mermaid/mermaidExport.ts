// Mermaid export utilities: SVG -> PNG rasterization, clipboard, files.
import { writeBinaryFile } from "../tauri/commands";
import { pickSavePath } from "../tauri/dialogs";

export type PngOptions = {
  scale: number;
  transparent: boolean;
  background?: string;
};

const DEFAULT_PNG: PngOptions = { scale: 2, transparent: false, background: "#ffffff" };

function svgDimensions(svg: string): { width: number; height: number } {
  const div = document.createElement("div");
  div.style.position = "absolute";
  div.style.visibility = "hidden";
  div.innerHTML = svg;
  document.body.appendChild(div);
  const el = div.querySelector("svg");
  let width = 800;
  let height = 600;
  if (el) {
    const bbox = el.getBoundingClientRect();
    width = Math.max(1, Math.ceil(bbox.width));
    height = Math.max(1, Math.ceil(bbox.height));
    const viewBox = el.getAttribute("viewBox");
    if ((!width || !height) && viewBox) {
      const parts = viewBox.split(/\s+/).map(Number);
      width = Math.ceil(parts[2] || 800);
      height = Math.ceil(parts[3] || 600);
    }
  }
  div.remove();
  return { width, height };
}

/** Ensure the SVG has explicit width/height so the rasterizer scales right. */
function normalizeSvg(svg: string): { svg: string; width: number; height: number } {
  const { width, height } = svgDimensions(svg);
  const withSize = svg.replace(
    /<svg([^>]*?)>/,
    (_m, attrs: string) => {
      const cleaned = attrs
        .replace(/\swidth="[^"]*"/, "")
        .replace(/\sheight="[^"]*"/, "");
      return `<svg${cleaned} width="${width}" height="${height}">`;
    },
  );
  return { svg: withSize, width, height };
}

export async function svgToPngBytes(
  svgText: string,
  options: Partial<PngOptions> = {},
): Promise<Uint8Array> {
  const opts = { ...DEFAULT_PNG, ...options };
  const { svg, width, height } = normalizeSvg(svgText);
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Could not rasterize SVG"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(width * opts.scale);
    canvas.height = Math.ceil(height * opts.scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");
    if (!opts.transparent) {
      ctx.fillStyle = opts.background ?? "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const pngBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("PNG encoding failed"))),
        "image/png",
      );
    });
    return new Uint8Array(await pngBlob.arrayBuffer());
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export async function saveSvgToFile(
  svg: string,
  suggestedName: string,
): Promise<boolean> {
  const path = await pickSavePath(suggestedName, "svg", "SVG Image");
  if (!path) return false;
  const bytes = new TextEncoder().encode(svg);
  await writeBinaryFile(path, bytesToBase64(bytes));
  return true;
}

export async function savePngToFile(
  svg: string,
  suggestedName: string,
  options?: Partial<PngOptions>,
): Promise<boolean> {
  const path = await pickSavePath(suggestedName, "png", "PNG Image");
  if (!path) return false;
  const bytes = await svgToPngBytes(svg, options);
  await writeBinaryFile(path, bytesToBase64(bytes));
  return true;
}

export async function copySvgToClipboard(svg: string): Promise<void> {
  await navigator.clipboard.writeText(svg);
}

export async function copyPngToClipboard(svg: string): Promise<void> {
  const bytes = await svgToPngBytes(svg);
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "image/png" });
  await navigator.clipboard.write([
    new ClipboardItem({ "image/png": blob }),
  ]);
}

export function diagramFilename(
  documentSlug: string,
  diagramIndex: number,
  diagramType: string,
  extension: string,
): string {
  return `${documentSlug}-${diagramIndex}-${diagramType}.${extension}`;
}
