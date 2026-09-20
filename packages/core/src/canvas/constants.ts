// Node shape option labels now live in the flowchart driver
// (src/diagrams/flowchart/flowchartDriver.ts) so every diagram owns its own
// node-kind vocabulary.

export interface ThemePreset {
  name: string;
  fill: string;
  stroke: string;
  color: string;
  bgPreview: string;
  borderPreview: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    name: 'Default',
    fill: '',
    stroke: '',
    color: '',
    bgPreview: 'transparent',
    borderPreview: 'var(--mermaid-border)',
  },
  {
    name: 'Emerald (Success)',
    fill: '#d1fae5',
    stroke: '#059669',
    color: '#065f46',
    bgPreview: '#10b981',
    borderPreview: '#047857',
  },
  {
    name: 'Sky (Process)',
    fill: '#e0f2fe',
    stroke: '#0284c7',
    color: '#0369a1',
    bgPreview: '#38bdf8',
    borderPreview: '#0284c7',
  },
  {
    name: 'Violet (Special)',
    fill: '#ede9fe',
    stroke: '#7c3aed',
    color: '#5b21b6',
    bgPreview: '#8b5cf6',
    borderPreview: '#6d28d9',
  },
  {
    name: 'Amber (Warning)',
    fill: '#fef3c7',
    stroke: '#d97706',
    color: '#92400e',
    bgPreview: '#f59e0b',
    borderPreview: '#d97706',
  },
  {
    name: 'Rose (Danger)',
    fill: '#ffe4e6',
    stroke: '#e11d48',
    color: '#9f1239',
    bgPreview: '#f43f5e',
    borderPreview: '#e11d48',
  },
  {
    name: 'Teal (Cloud)',
    fill: '#ccfbf1',
    stroke: '#0d9488',
    color: '#115e59',
    bgPreview: '#14b8a6',
    borderPreview: '#0f766e',
  },
  {
    name: 'Slate (System)',
    fill: '#334155',
    stroke: '#0f172a',
    color: '#f8fafc',
    bgPreview: '#475569',
    borderPreview: '#1e293b',
  },
];

export interface EdgeThemePreset {
  name: string;
  stroke: string;
  bgPreview: string;
  borderPreview: string;
}

export const EDGE_THEME_PRESETS: EdgeThemePreset[] = [
  {
    name: 'Default',
    stroke: '',
    bgPreview: 'transparent',
    borderPreview: 'var(--mermaid-border)',
  },
  {
    name: 'Violet (Primary)',
    stroke: '#7c3aed',
    bgPreview: '#8b5cf6',
    borderPreview: '#6d28d9',
  },
  {
    name: 'Emerald (Success / Yes)',
    stroke: '#059669',
    bgPreview: '#10b981',
    borderPreview: '#047857',
  },
  {
    name: 'Rose (Danger / No)',
    stroke: '#e11d48',
    bgPreview: '#f43f5e',
    borderPreview: '#be123c',
  },
  {
    name: 'Amber (Warning / Alert)',
    stroke: '#d97706',
    bgPreview: '#f59e0b',
    borderPreview: '#b45309',
  },
  {
    name: 'Sky (Info / Action)',
    stroke: '#0284c7',
    bgPreview: '#38bdf8',
    borderPreview: '#0369a1',
  },
  {
    name: 'Slate (Neutral)',
    stroke: '#64748b',
    bgPreview: '#94a3b8',
    borderPreview: '#475569',
  },
  {
    name: 'Monochrome Dark',
    stroke: '#334155',
    bgPreview: '#475569',
    borderPreview: '#0f172a',
  },
];
