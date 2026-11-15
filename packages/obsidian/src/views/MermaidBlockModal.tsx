import { Modal, App, Notice, TFile } from 'obsidian';
import * as React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { NativeMermaidView, replaceMermaidBlock } from '@merlay/core';
import { getObsidianHost } from '../obsidian/obsidianHost';
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
  private recoveryModal: Modal | null = null;
  private recoveryText: HTMLTextAreaElement | null = null;

  constructor(
    app: App,
    plugin: MerlayPlugin,
    filePath: string,
    sectionInfo: SectionInfo,
    initialCode: string,
    private documentText: string
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
    try {
      const file = this.app.vault.getAbstractFileByPath(this.filePath);
      if (!(file instanceof TFile)) throw new Error('The note was moved or deleted.');
      const saved: { result?: ReturnType<typeof replaceMermaidBlock> } = {};
      await this.app.vault.process(file, (data) => {
        saved.result = replaceMermaidBlock(
          data,
          codeToSave,
          this.sectionInfo.lineStart,
          this.initialCode,
          undefined,
          this.documentText
        );
        return saved.result.updatedText;
      });
      if (!saved.result) throw new Error('The note could not be updated.');
      this.sectionInfo.lineStart = saved.result.newStartLine;
      this.sectionInfo.lineEnd = saved.result.newEndLine;
      this.documentText = saved.result.updatedText;
      this.initialCode = codeToSave.trim();
    } catch (e: unknown) {
      const detail = e instanceof Error ? e.message : String(e);
      new Notice(`Failed to save Mermaid diagram: ${detail}`);
      // The canvas may already have closed while its final save was pending.
      // Keep a selectable recovery copy available even in that case.
      if (!this.recoveryModal) {
        this.recoveryModal = new Modal(this.app);
        this.recoveryModal.contentEl.createEl('h2', { text: 'Unsaved diagram' });
        this.recoveryModal.contentEl.createEl('p', {
          text: 'Copy your diagram source before closing this window, then reopen the diagram to retry.',
        });
        this.recoveryText = this.recoveryModal.contentEl.createEl('textarea', {
          cls: 'mermaid-code-drawer-textarea',
          attr: { readonly: '', rows: '12', 'aria-label': 'Unsaved Mermaid source' },
        });
        this.recoveryModal.onClose = () => {
          this.recoveryModal = null;
          this.recoveryText = null;
        };
        this.recoveryModal.open();
      }
      if (this.recoveryText) this.recoveryText.value = this.latestCode;
    }
  }
}
