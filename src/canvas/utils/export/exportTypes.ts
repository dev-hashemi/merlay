import type { App } from 'obsidian';

export type ExportAppearance = 'as-shown' | 'readable';

export interface ExportOptions {
  includeBackground?: boolean;
  backgroundColor?: string;
  appearance?: ExportAppearance;
  scale?: number;
  fileName?: string;
}

export type ExportTarget =
  | HTMLElement
  | {
      app?: App;
      code?: string;
      svgMountEl?: HTMLElement | null;
    };
