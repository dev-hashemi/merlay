/**
 * Public surface of `@merlay/core`.
 *
 * Hosts (Obsidian plugin, VS Code extension, web app) import ONLY from here —
 * never via deep relative paths. Keep this list to what hosts actually use.
 */

// Interactive canvas
export { NativeMermaidView } from './canvas/NativeMermaidView';
export type { NativeMermaidViewProps } from './canvas/types';

// Platform seam (implemented per host)
export type {
  HostAdapter,
  NotifyFn,
  RenderMermaidFn,
  UnsubscribeFn,
} from './platform/types';
// npm-backed engine for hosts without a native Mermaid runtime
export { renderMermaidWithNpm } from './platform/mermaidEngine';

// Diagram drivers
export type {
  DiagramDriver,
  DiagramMutations,
  DiagramTemplate,
} from './diagrams/types';
export {
  DIAGRAM_TEMPLATES,
  DIAGRAM_DISPLAY_NAMES,
  detectDiagramType,
  isDiagramSupported,
} from './diagrams/registry';
export type { FlowchartDirection } from './diagrams/viewModel';

// Markdown fence helpers
export {
  findMermaidBlockBounds,
  replaceMermaidBlock,
  findTargetMermaidBlock,
  isCursorInMermaidBlock,
} from './utils/markdownBlock';
