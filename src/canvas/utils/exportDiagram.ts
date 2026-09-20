/**
 * Merlay High-Fidelity Diagram Export Engine
 *
 * Implements 100% authentic, universal Mermaid.js export:
 * 1. Universal SVG Text: Converts <foreignObject> to native SVG <text> elements
 *    with <tspan> so all viewers render text with 100% reliability.
 * 2. True Dark/Light Theme Support: Automatically detects Obsidian's active theme.
 * 3. Exact Background Coverage: ViewBox-aligned background rect.
 * 4. High-DPI PNG Rasterization: Uses UTF-8 Base64 Data URI to prevent canvas tainting.
 *
 * Facade module re-exporting domain units from `./export/`.
 */

export * from './export';
