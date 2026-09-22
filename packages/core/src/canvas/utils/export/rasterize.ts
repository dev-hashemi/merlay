/**
 * Rasterization (HTML5 Canvas PNG) and Clipboard / Download helpers for diagram export.
 */

import { ExportOptions, ExportTarget } from './exportTypes';
import { isDarkThemeActive, resolveThemeBackgroundColor } from './colorTransforms';
import { convertForeignObjectsToSvgText } from './foreignObjects';
import {
  getExportSvgResult,
  normalizeTarget,
  parseSvgString,
} from './svgNormalize';
import { createAnchorElement, createCanvasElement } from '../../../platform/dom';

/**
 * Converts an SVG string into a UTF-8 Base64 Data URL.
 */
export function svgStringToDataUrl(svgString: string): string {
  const bytes = new TextEncoder().encode(svgString);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `data:image/svg+xml;base64,${btoa(binary)}`;
}

/**
 * High-DPI rasterization of serialized SVG to an HTML Canvas Blob.
 * Uses Base64 Data URI to prevent canvas tainting in Chromium.
 */
export async function rasterizeSvgToBlob(
  svgString: string,
  width: number,
  height: number,
  options: ExportOptions,
  _filter?: string | null,
  svgMountEl?: HTMLElement | null
): Promise<Blob | null> {
  const scale = options.scale || 2; // Default to 2x retina
  const canvas = createCanvasElement();
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  if (options.includeBackground) {
    const bgColor = resolveThemeBackgroundColor(svgMountEl, options.backgroundColor);
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  const dataUrl = svgStringToDataUrl(svgString);

  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to load image from SVG'));
      img.src = dataUrl;
    });

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  } catch (err) {
    console.warn('Merlay: Direct Data URL canvas drawing failed, attempting text fallback', err);
    const fallbackSvg = parseSvgString(svgString);
    if (fallbackSvg) {
      convertForeignObjectsToSvgText(fallbackSvg, isDarkThemeActive());
      const fallbackStr = new XMLSerializer().serializeToString(fallbackSvg);
      const fallbackUrl = svgStringToDataUrl(fallbackStr);
      const fallbackImg = new Image();
      await new Promise<void>((resolve, reject) => {
        fallbackImg.onload = () => resolve();
        fallbackImg.onerror = () => reject(new Error('Failed to load SVG fallback image'));
        fallbackImg.src = fallbackUrl;
      });
      ctx.drawImage(fallbackImg, 0, 0, canvas.width, canvas.height);
    }
  }

  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
}

/**
 * Copies clean SVG vector markup directly to clipboard.
 */
export async function copySvgToClipboard(
  targetInput: ExportTarget,
  options: ExportOptions = {}
): Promise<boolean> {
  const res = await getExportSvgResult(targetInput, options);
  if (!res) {
    options.notify?.('Failed to export: No diagram found');
    return false;
  }
  try {
    await navigator.clipboard.writeText(res.svgString);
    options.notify?.('SVG copied to clipboard');
    return true;
  } catch (e) {
    console.error('Failed to copy SVG to clipboard:', e);
    options.notify?.('Failed to copy SVG to clipboard');
    return false;
  }
}

/**
 * Downloads the diagram as a standalone .svg file.
 */
export async function downloadSvg(
  targetInput: ExportTarget,
  options: ExportOptions = {}
): Promise<boolean> {
  const res = await getExportSvgResult(targetInput, options);
  if (!res) {
    options.notify?.('Failed to export: No diagram found');
    return false;
  }
  try {
    const blob = new Blob([res.svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = createAnchorElement();
    link.href = url;
    link.download = `${options.fileName || 'diagram'}.svg`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    options.notify?.('SVG downloaded');
    return true;
  } catch (e) {
    console.error('Failed to download SVG:', e);
    options.notify?.('Failed to download SVG');
    return false;
  }
}

/**
 * Copies rendered high-resolution PNG image directly to clipboard.
 */
export async function copyPngToClipboard(
  targetInput: ExportTarget,
  options: ExportOptions = {}
): Promise<boolean> {
  const res = await getExportSvgResult(targetInput, options);
  if (!res) {
    options.notify?.('Failed to export: No diagram found');
    return false;
  }
  const target = normalizeTarget(targetInput);
  try {
    const blob = await rasterizeSvgToBlob(
      res.svgString,
      res.width,
      res.height,
      options,
      null,
      target.svgMountEl
    );
    if (!blob) {
      options.notify?.('Failed to rasterize PNG');
      return false;
    }
    await navigator.clipboard.write([
      new ClipboardItem({
        'image/png': blob,
      }),
    ]);
    options.notify?.('PNG copied to clipboard');
    return true;
  } catch (e) {
    console.error('Failed to copy PNG to clipboard:', e);
    options.notify?.('Failed to copy PNG to clipboard');
    return false;
  }
}

/**
 * Downloads the diagram as a standalone high-resolution .png file.
 */
export async function downloadPng(
  targetInput: ExportTarget,
  options: ExportOptions = {}
): Promise<boolean> {
  const res = await getExportSvgResult(targetInput, options);
  if (!res) {
    options.notify?.('Failed to export: No diagram found');
    return false;
  }
  const target = normalizeTarget(targetInput);
  try {
    const blob = await rasterizeSvgToBlob(
      res.svgString,
      res.width,
      res.height,
      options,
      null,
      target.svgMountEl
    );
    if (!blob) {
      options.notify?.('Failed to rasterize PNG');
      return false;
    }
    const url = URL.createObjectURL(blob);
    const link = createAnchorElement();
    link.href = url;
    link.download = `${options.fileName || 'diagram'}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    options.notify?.('PNG downloaded');
    return true;
  } catch (e) {
    console.error('Failed to download PNG:', e);
    options.notify?.('Failed to download PNG');
    return false;
  }
}
