import type { NotifyFn, RenderMermaidFn } from '../../../platform/types';

export type ExportAppearance = 'as-shown' | 'readable';

export interface ExportOptions {
  includeBackground?: boolean;
  backgroundColor?: string;
  appearance?: ExportAppearance;
  scale?: number;
  fileName?: string;
  /** Optional toast/notice sink. Silent when omitted (headless/tests). */
  notify?: NotifyFn;
}

export type ExportTarget =
  | HTMLElement
  | {
      /** Re-render path: needs both code and a host render function. */
      renderMermaid?: RenderMermaidFn;
      code?: string;
      svgMountEl?: HTMLElement | null;
    };
