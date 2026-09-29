/**
 * Flowchart shape registry — single source of truth for every Mermaid
 * flowchart node shape.
 *
 * The original 14 classic delimiter shapes keep their legacy kind names and
 * serialize with delimiters (`[...]`, `(...)`, ...). Mermaid v11.3+ shapes
 * use the canonical short name as kind and serialize as
 * `ID@{ shape: <short>, label: "..." }`.
 *
 * Same-concept aliases (rect->rectangle, diam->diamond, lean-r->parallelogram,
 * trap-b->trapezoid, cyl->cylinder, ...) resolve to the legacy kind so old
 * diagrams keep their syntax. Only genuinely new concepts get new kinds.
 */

import { MermaidShapeType } from '../viewModel';

export type ShapeCategory =
  | 'Common'
  | 'Logic & Flow'
  | 'Data & Documents'
  | 'Notes & More'
  | 'Special';

export interface FlowchartShapeDef {
  kind: MermaidShapeType;
  /** Canonical short name used in `@{ shape: ... }`. Legacy kinds map here too. */
  shortName: string;
  aliases: string[];
  label: string;
  category: ShapeCategory;
  keywords: string;
  /** True for the original 14 delimiter shapes (serialize with delimiters). */
  classic: boolean;
  /**
   * Minimum Mermaid version supporting this shape (e.g. '11.17.0' for the
   * person/bucket/console/browser batch). Hosts with older renderers
   * (Obsidian's bundled Mermaid lags npm) hide these from the picker —
   * offering them would break the whole diagram with "No such shape".
   * Parsing/serialization still support them everywhere.
   */
  since?: string;
}

/** Pinned static favorites shown first in the picker. */
export const COMMON_SHAPE_KINDS: readonly string[] = [
  'rectangle',
  'rounded',
  'stadium',
  'diamond',
  'circle',
  'cylinder',
];

export const FLOWCHART_SHAPES: readonly FlowchartShapeDef[] = [
  // --- Common (classic) ---
  { kind: 'rectangle', shortName: 'rect', aliases: ['proc', 'process', 'rectangle'], label: 'Process', category: 'Common', keywords: 'process step task action rectangle box', classic: true },
  { kind: 'rounded', shortName: 'rounded', aliases: ['event'], label: 'Event', category: 'Common', keywords: 'event start end rounded terminal soft', classic: true },
  { kind: 'stadium', shortName: 'stadium', aliases: ['pill', 'terminal'], label: 'Terminal', category: 'Common', keywords: 'terminal start end pill stadium', classic: true },
  { kind: 'diamond', shortName: 'diam', aliases: ['decision', 'diamond', 'question'], label: 'Decision', category: 'Common', keywords: 'decision choice branch yes no diamond question', classic: true },
  { kind: 'circle', shortName: 'circle', aliases: ['circ'], label: 'Start', category: 'Common', keywords: 'start circle endpoint connector begin', classic: true },
  { kind: 'cylinder', shortName: 'cyl', aliases: ['cylinder', 'database', 'db'], label: 'Database', category: 'Common', keywords: 'database data store cylinder db storage', classic: true },
  // --- Logic & Flow (classic) ---
  { kind: 'subroutine', shortName: 'subproc', aliases: ['fr-rect', 'framed-rectangle', 'subprocess', 'subroutine'], label: 'Subprocess', category: 'Logic & Flow', keywords: 'subprocess subroutine function call framed predefined', classic: true },
  { kind: 'hexagon', shortName: 'hex', aliases: ['hexagon', 'prepare'], label: 'Prepare', category: 'Logic & Flow', keywords: 'prepare condition hexagon setup', classic: true },
  { kind: 'parallelogram', shortName: 'lean-r', aliases: ['in-out', 'lean-right'], label: 'Input / Output', category: 'Logic & Flow', keywords: 'input output data lean io parallelogram', classic: true },
  { kind: 'parallelogram_alt', shortName: 'lean-l', aliases: ['lean-left', 'out-in'], label: 'Output / Input', category: 'Logic & Flow', keywords: 'output input data lean parallelogram', classic: true },
  { kind: 'trapezoid', shortName: 'trap-b', aliases: ['priority', 'trapezoid-bottom'], label: 'Priority Action', category: 'Logic & Flow', keywords: 'priority action trapezoid manual', classic: true },
  { kind: 'trapezoid_alt', shortName: 'trap-t', aliases: ['inv-trapezoid', 'manual', 'trapezoid-top'], label: 'Manual Task', category: 'Logic & Flow', keywords: 'manual operation task trapezoid people', classic: true },
  { kind: 'asymmetric', shortName: 'odd', aliases: [], label: 'Flag', category: 'Logic & Flow', keywords: 'flag tag banner asymmetric odd', classic: true },
  { kind: 'double_circle', shortName: 'dbl-circ', aliases: ['double-circle'], label: 'Stop', category: 'Logic & Flow', keywords: 'stop end double circle finish', classic: true },
  // --- Logic & Flow (new) ---
  { kind: 'fork', shortName: 'fork', aliases: ['join'], label: 'Fork / Join', category: 'Logic & Flow', keywords: 'fork join parallel sync split bar', classic: false },
  { kind: 'delay', shortName: 'delay', aliases: ['half-rounded-rectangle'], label: 'Delay', category: 'Logic & Flow', keywords: 'delay wait pause half rounded', classic: false },
  { kind: 'tri', shortName: 'tri', aliases: ['extract', 'triangle'], label: 'Extract', category: 'Logic & Flow', keywords: 'extract triangle filter sort', classic: false },
  { kind: 'flip-tri', shortName: 'flip-tri', aliases: ['flipped-triangle', 'manual-file'], label: 'Manual File', category: 'Logic & Flow', keywords: 'manual file flipped triangle paper', classic: false },
  { kind: 'notch-pent', shortName: 'notch-pent', aliases: ['loop-limit', 'notched-pentagon'], label: 'Loop Limit', category: 'Logic & Flow', keywords: 'loop limit iteration pentagon counter', classic: false },
  { kind: 'hourglass', shortName: 'hourglass', aliases: ['collate'], label: 'Collate', category: 'Logic & Flow', keywords: 'collate hourglass merge sort', classic: false },
  { kind: 'bolt', shortName: 'bolt', aliases: ['com-link', 'lightning-bolt'], label: 'Com Link', category: 'Logic & Flow', keywords: 'communication lightning bolt link fast message', classic: false },
  { kind: 'f-circ', shortName: 'f-circ', aliases: ['filled-circle', 'junction'], label: 'Junction', category: 'Logic & Flow', keywords: 'junction filled circle point dot connector', classic: false },
  { kind: 'cross-circ', shortName: 'cross-circ', aliases: ['crossed-circle', 'summary'], label: 'Summary', category: 'Logic & Flow', keywords: 'summary crossed circle total', classic: false },
  { kind: 'sm-circ', shortName: 'sm-circ', aliases: ['small-circle', 'start'], label: 'Small Start', category: 'Logic & Flow', keywords: 'small start circle begin tiny', classic: false },
  { kind: 'fr-circ', shortName: 'fr-circ', aliases: ['framed-circle', 'stop'], label: 'Framed Stop', category: 'Logic & Flow', keywords: 'framed stop circle end halt', classic: false },
  { kind: 'odd', shortName: 'odd', aliases: [], label: 'Odd', category: 'Logic & Flow', keywords: 'odd special custom', classic: false },
  // --- Data & Documents ---
  { kind: 'datastore', shortName: 'datastore', aliases: ['data-store'], label: 'Datastore', category: 'Data & Documents', keywords: 'datastore data store flow parallel lines', classic: false },
  { kind: 'doc', shortName: 'doc', aliases: ['document'], label: 'Document', category: 'Data & Documents', keywords: 'document paper page doc single sheet', classic: false },
  { kind: 'docs', shortName: 'docs', aliases: ['documents', 'st-doc', 'stacked-document'], label: 'Multi-Document', category: 'Data & Documents', keywords: 'multiple documents stack papers multi report', classic: false },
  { kind: 'lin-doc', shortName: 'lin-doc', aliases: ['lined-document'], label: 'Lined Document', category: 'Data & Documents', keywords: 'lined document form lines ruled', classic: false },
  { kind: 'tag-doc', shortName: 'tag-doc', aliases: ['tagged-document'], label: 'Tagged Document', category: 'Data & Documents', keywords: 'tagged document label tag folder', classic: false },
  { kind: 'folder', shortName: 'folder', aliases: ['directory'], label: 'Folder', category: 'Data & Documents', keywords: 'folder directory files archive', classic: false, since: '11.17.0' },
  { kind: 'bucket', shortName: 'bucket', aliases: [], label: 'Bucket', category: 'Data & Documents', keywords: 'bucket storage cloud object s3', classic: false, since: '11.17.0' },
  { kind: 'h-cyl', shortName: 'h-cyl', aliases: ['das', 'horizontal-cylinder'], label: 'Direct Storage', category: 'Data & Documents', keywords: 'direct access storage horizontal cylinder disk das', classic: false },
  { kind: 'lin-cyl', shortName: 'lin-cyl', aliases: ['disk', 'lined-cylinder'], label: 'Disk Storage', category: 'Data & Documents', keywords: 'disk storage lined cylinder database platter', classic: false },
  { kind: 'curv-trap', shortName: 'curv-trap', aliases: ['curved-trapezoid', 'display'], label: 'Display', category: 'Data & Documents', keywords: 'display screen curved monitor show', classic: false },
  { kind: 'div-rect', shortName: 'div-rect', aliases: ['div-proc', 'divided-process', 'divided-rectangle'], label: 'Divided Process', category: 'Data & Documents', keywords: 'divided process split columns', classic: false },
  { kind: 'lin-rect', shortName: 'lin-rect', aliases: ['lin-proc', 'lined-process', 'lined-rectangle', 'shaded-process'], label: 'Lined Process', category: 'Data & Documents', keywords: 'lined shaded process stripes', classic: false },
  { kind: 'notch-rect', shortName: 'notch-rect', aliases: ['card', 'notched-rectangle'], label: 'Card', category: 'Data & Documents', keywords: 'card notched punched ticket', classic: false },
  { kind: 'tag-rect', shortName: 'tag-rect', aliases: ['tag-proc', 'tagged-process', 'tagged-rectangle'], label: 'Tagged Process', category: 'Data & Documents', keywords: 'tagged process label tag ribbon', classic: false },
  { kind: 'st-rect', shortName: 'st-rect', aliases: ['processes', 'procs', 'stacked-rectangle'], label: 'Multi-Process', category: 'Data & Documents', keywords: 'multiple processes stack multi batch', classic: false },
  { kind: 'sl-rect', shortName: 'sl-rect', aliases: ['manual-input', 'sloped-rectangle'], label: 'Manual Input', category: 'Data & Documents', keywords: 'manual input keyboard sloped form fill human type', classic: false },
  { kind: 'bow-rect', shortName: 'bow-rect', aliases: ['bow-tie-rectangle', 'stored-data'], label: 'Stored Data', category: 'Data & Documents', keywords: 'stored data bow tie saved', classic: false },
  { kind: 'win-pane', shortName: 'win-pane', aliases: ['internal-storage', 'window-pane'], label: 'Internal Storage', category: 'Data & Documents', keywords: 'internal storage memory window pane chip', classic: false },
  { kind: 'flag', shortName: 'flag', aliases: ['paper-tape'], label: 'Paper Tape', category: 'Data & Documents', keywords: 'paper tape flag receipt punch streamer', classic: false },
  { kind: 'console', shortName: 'console', aliases: [], label: 'Console', category: 'Data & Documents', keywords: 'console terminal window screen command', classic: false, since: '11.17.0' },
  { kind: 'browser', shortName: 'browser', aliases: [], label: 'Browser', category: 'Data & Documents', keywords: 'browser window web page tab', classic: false, since: '11.17.0' },
  // --- Notes & More ---
  { kind: 'text', shortName: 'text', aliases: [], label: 'Text Block', category: 'Notes & More', keywords: 'text note label block plain annotation', classic: false },
  { kind: 'brace', shortName: 'brace', aliases: ['brace-l', 'comment'], label: 'Comment', category: 'Notes & More', keywords: 'comment note brace annotation remark curly', classic: false },
  { kind: 'brace-r', shortName: 'brace-r', aliases: [], label: 'Comment Right', category: 'Notes & More', keywords: 'comment note brace right annotation remark', classic: false },
  { kind: 'braces', shortName: 'braces', aliases: [], label: 'Comment Both', category: 'Notes & More', keywords: 'comment note braces both annotation remark', classic: false },
  { kind: 'person', shortName: 'person', aliases: [], label: 'Person', category: 'Notes & More', keywords: 'person user human actor people role', classic: false, since: '11.17.0' },
  // --- Special (extra params, label still editable) ---
  { kind: 'icon', shortName: 'icon', aliases: [], label: 'Icon', category: 'Special', keywords: 'icon symbol picture glyph logo', classic: false },
  { kind: 'image', shortName: 'image', aliases: ['img'], label: 'Image', category: 'Special', keywords: 'image picture photo img graphic', classic: false },
];

const aliasToKind = new Map<string, MermaidShapeType>();
for (const def of FLOWCHART_SHAPES) {
  aliasToKind.set(def.shortName.toLowerCase(), def.kind);
  aliasToKind.set(def.kind.toLowerCase(), def.kind);
  for (const a of def.aliases) aliasToKind.set(a.toLowerCase(), def.kind);
}

/** Resolve any Mermaid shape name/alias to our canonical kind. Null = unknown. */
export function resolveShapeAlias(name: string): MermaidShapeType | null {
  return aliasToKind.get(name.trim().toLowerCase()) ?? null;
}

export function shapeDefFor(kind: string): FlowchartShapeDef | undefined {
  return FLOWCHART_SHAPES.find((d) => d.kind === kind);
}

export function isClassicShape(kind: string): boolean {
  return shapeDefFor(kind)?.classic ?? true;
}

export function shortNameFor(kind: string): string {
  return shapeDefFor(kind)?.shortName ?? kind;
}

/**
 * Kinds that need a Mermaid version newer than the 11.3 baseline
 * (currently the 11.17.0 batch). Hosts probe these against their own
 * renderer and hide the unsupported ones from the picker.
 */
export function versionGatedKinds(): MermaidShapeType[] {
  return FLOWCHART_SHAPES.filter((d) => d.since).map((d) => d.kind);
}

export interface ParsedShapeMeta {
  shape?: string;
  label?: string;
  params: Record<string, string>;
}

/**
 * Parse the inside of `@{ ... }` into key/value pairs, respecting
 * double-quoted values that may contain commas or braces.
 */
export function parseShapeMetaInner(inner: string): ParsedShapeMeta {
  const params: Record<string, string> = {};
  let shape: string | undefined;
  let label: string | undefined;
  // Split on commas outside double quotes.
  const parts: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (ch === '"' && inner[i - 1] !== '\\') inQuotes = !inQuotes;
    if (ch === ',' && !inQuotes) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current);
  for (const part of parts) {
    const colon = part.indexOf(':');
    if (colon === -1) continue;
    const key = part.slice(0, colon).trim();
    let value = part.slice(colon + 1).trim();
    if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
      value = value.slice(1, -1).replace(/#quot;/g, '"');
    }
    if (!key) continue;
    if (key === 'shape') shape = value;
    else if (key === 'label') label = value;
    else params[key] = value;
  }
  return { shape, label, params };
}
