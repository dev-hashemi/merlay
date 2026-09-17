import { Modal, App, Notice, TFile } from 'obsidian';
import * as React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { NativeMermaidView } from '../canvas/NativeMermaidView';
import { replaceMermaidBlock } from '../utils/markdownBlock';
import type MerlayPlugin from '../main';

export interface SectionInfo {
  lineStart: number;
  lineEnd: number;
  text?: string;
}

export class MermaidBlockModal extends Modal {
  private root: Root | null = null;
  private filePath: string;
  private sectionInfo: SectionInfo;
  private initialCode: string;
  private latestCode: string;
  private plugin: MerlayPlugin;
  private saveTimeout: number | null = null;
  private isFullscreen: boolean = false;

  constructor(
    app: App,
    plugin: MerlayPlugin,
    filePath: string,
    sectionInfo: SectionInfo,
    initialCode: string
  ) {
    super(app);
    this.plugin = plugin;
    this.filePath = filePath;
    this.sectionInfo = sectionInfo;
    this.initialCode = initialCode.trim();
    this.latestCode = this.initialCode;
  }

  private toggleFullscreen = (): void => {
    this.isFullscreen = !this.isFullscreen;
    if (this.isFullscreen) {
      this.modalEl.addClass('is-fullscreen');
    } else {
      this.modalEl.removeClass('is-fullscreen');
    }
  };

  onOpen(): void {
    const { contentEl, modalEl } = this;
    modalEl.addClass('mod-mermaid-block-modal');
    contentEl.empty();
    contentEl.addClass('mermaid-block-modal-root');

    this.root = createRoot(contentEl);
    this.root.render(
      <NativeMermaidView
        app={this.app}
        initialCode={this.initialCode}
        onCodeChange={(newCode) => {
          this.latestCode = newCode;
          this.scheduleSave();
        }}
        onClose={() => this.close()}
        isFullscreen={this.isFullscreen}
        onToggleFullscreen={this.toggleFullscreen}
      />
    );
  }

  onClose(): void {
    if (this.saveTimeout !== null) {
      window.clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }

    if (this.latestCode !== this.initialCode) {
      void this.saveToNote();
    }

    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
  }

  private scheduleSave(): void {
    if (this.saveTimeout !== null) {
      window.clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = window.setTimeout(() => {
      this.saveTimeout = null;
      void this.saveToNote();
    }, 250);
  }

  private async saveToNote(): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(this.filePath);
    if (!(file instanceof TFile)) return;

    try {
      await this.app.vault.process(file, (data) => {
        const res = replaceMermaidBlock(
          data,
          this.latestCode,
          this.sectionInfo.lineStart,
          this.initialCode,
          this.latestCode
        );

        this.sectionInfo.lineStart = res.newStartLine;
        this.sectionInfo.lineEnd = res.newEndLine;
        this.initialCode = this.latestCode.trim();

        return res.updatedText;
      });
    } catch (e: unknown) {
      console.error('Error saving mermaid block to note:', e);
      new Notice(`Failed to save Mermaid diagram: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}
