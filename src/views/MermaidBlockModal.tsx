import { Modal, App, Notice, TFile } from 'obsidian';
import * as React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { NativeMermaidView } from '../canvas/NativeMermaidView';
import { getObsidianHost } from '../obsidian/obsidianHost';
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
  private saveChain: Promise<void> = Promise.resolve();
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
    // Phones have no room for a windowed modal: start fullscreen on coarse
    // pointers or narrow viewports (user can still exit via the toggle).
    if (!this.isFullscreen && typeof window !== 'undefined') {
      const coarse =
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(pointer: coarse)').matches;
      if (coarse || window.innerWidth < 700) {
        this.toggleFullscreen();
      }
    }
    contentEl.empty();
    contentEl.addClass('mermaid-block-modal-root');

    this.root = createRoot(contentEl);
    this.root.render(
      <NativeMermaidView
        host={getObsidianHost(this.app)}
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
      this.enqueueSave();
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
      this.enqueueSave();
    }, 250);
  }

  // Serializes vault writes: a debounced save already awaiting vault.process
  // must finish before onClose's final save starts, otherwise the two
  // concurrent writes race and one edit is lost (last-writer-wins).
  private enqueueSave(): void {
    const codeToSave = this.latestCode;
    this.saveChain = this.saveChain.then(() => this.writeCodeToNote(codeToSave));
  }

  private async writeCodeToNote(codeToSave: string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(this.filePath);
    if (!(file instanceof TFile)) return;

    try {
      await this.app.vault.process(file, (data) => {
        const res = replaceMermaidBlock(
          data,
          codeToSave,
          this.sectionInfo.lineStart,
          this.initialCode,
          codeToSave
        );

        this.sectionInfo.lineStart = res.newStartLine;
        this.sectionInfo.lineEnd = res.newEndLine;
        if (this.latestCode === codeToSave) this.initialCode = codeToSave.trim();

        return res.updatedText;
      });
    } catch (e: unknown) {
      console.error('Error saving mermaid block to note:', e);
      new Notice(`Failed to save Mermaid diagram: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}
