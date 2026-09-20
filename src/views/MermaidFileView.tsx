import { TextFileView, WorkspaceLeaf } from 'obsidian';
import * as React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { NativeMermaidView } from '../canvas/NativeMermaidView';
import { getObsidianHost } from '../obsidian/obsidianHost';
import { MERLAY_ICON_ID } from '../obsidian/icons';
import type MerlayPlugin from '../main';

export const VIEW_TYPE_MERMAID_FILE = 'mermaid-visual-file-view';

export class MermaidFileView extends TextFileView {
  private root: Root | null = null;
  private currentData: string = '';
  private plugin: MerlayPlugin;

  constructor(leaf: WorkspaceLeaf, plugin: MerlayPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return VIEW_TYPE_MERMAID_FILE;
  }

  getDisplayText(): string {
    return this.file ? this.file.basename : 'Merlay Diagram';
  }

  getIcon(): string {
    return MERLAY_ICON_ID;
  }

  getViewData(): string {
    return this.currentData;
  }

  setViewData(data: string, clear: boolean): void {
    this.currentData =
      data || 'flowchart LR\n    A["Start"] --> B["Process"]\n    B --> C["End"]';

    if (clear && this.root) {
      this.root.unmount();
      this.root = null;
    }

    if (!this.root) {
      const container = this.contentEl;
      container.empty();
      container.addClass('merlay-leaf-root');
      this.root = createRoot(container);
    }

    this.root.render(
      <NativeMermaidView
        host={getObsidianHost(this.app)}
        initialCode={this.currentData}
        onCodeChange={(newCode) => {
          this.currentData = newCode;
          this.requestSave();
        }}
      />
    );
  }

  clear(): void {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
    this.currentData = '';
  }

  async onClose(): Promise<void> {
    this.clear();
  }
}
