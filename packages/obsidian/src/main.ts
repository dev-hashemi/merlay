import {
  Plugin,
  WorkspaceLeaf,
  MarkdownView,
  MarkdownPostProcessorContext,
} from 'obsidian';
import {
  DEFAULT_SETTINGS,
  MerlaySettings,
  MerlaySettingTab,
} from './settings/SettingsTab';
import {
  MermaidFileView,
  VIEW_TYPE_MERMAID_FILE,
} from './views/MermaidFileView';
import {
  MermaidObserverChild,
  setupGlobalWorkspaceObserver,
  scanAndAttachToElement,
  scanActiveWorkspace,
  scanActiveView,
} from './obsidian/workspaceObserver';
import {
  createNewDiagram,
  createDiagramFileWithTemplate,
  openVisualModeForActiveFile,
  insertMermaidBlockAtCursor,
} from './obsidian/diagramOpener';
import { DiagramTemplateModal } from './views/DiagramTemplateModal';
import { DiagramTemplate } from '@merlay/core';
import { MERLAY_ICON_ID, registerMerlayIcons } from './obsidian/icons';
import { registerContextMenus } from './obsidian/registerMenus';
import { registerCommands } from './obsidian/registerCommands';

export default class MerlayPlugin extends Plugin {
  public settings: MerlaySettings = DEFAULT_SETTINGS;

  async onload() {
    // Register custom Merlay logo icon in Obsidian icon library
    registerMerlayIcons();

    await this.loadSettings();

    // 1. Register custom File View for standalone .mmd and .mermaid files
    this.registerView(
      VIEW_TYPE_MERMAID_FILE,
      (leaf: WorkspaceLeaf) => new MermaidFileView(leaf, this)
    );
    this.registerExtensions(['mmd', 'mermaid'], VIEW_TYPE_MERMAID_FILE);

    // 2. Register Markdown Post-Processor (Reading View & Live Preview)
    this.registerMarkdownPostProcessor((element, context) => {
      const info = context.getSectionInfo(element);
      if (info) {
        element.setAttribute('data-mermaid-line-start', String(info.lineStart));
        element.setAttribute('data-mermaid-line-end', String(info.lineEnd));
      }
      scanAndAttachToElement(element, this, context.sourcePath, context);

      // MutationObserver to catch asynchronous Mermaid SVG rendering
      const observer = new MutationObserver(() => {
        scanAndAttachToElement(element, this, context.sourcePath, context);
      });
      observer.observe(element, { childList: true, subtree: true });

      context.addChild(new MermaidObserverChild(element, observer));
    });

    // 3. Global workspace DOM observer for Live Preview & Reading View
    this.app.workspace.onLayoutReady(() => {
      setupGlobalWorkspaceObserver(this);
    });

    // 4. Ribbon Icon
    this.addRibbonIcon(MERLAY_ICON_ID, 'Merlay', () => {
      void this.createNewDiagram();
    });

    // 5. Context Menus (Right-Click: Editor and File Explorer)
    registerContextMenus(this);

    // 6. Commands (available in Command Palette and Slash Commands "/")
    registerCommands(this);

    // 7. Settings Tab
    this.addSettingTab(new MerlaySettingTab(this.app, this));
  }

  // Delegated helpers for backward compatibility
  scanActiveWorkspace(): void {
    scanActiveWorkspace(this);
  }

  scanActiveView(): void {
    scanActiveView(this);
  }

  scanAndAttachToElement(
    container: HTMLElement,
    sourcePath?: string,
    context?: MarkdownPostProcessorContext
  ): void {
    scanAndAttachToElement(container, this, sourcePath, context);
  }

  openVisualModeForActiveFile(view: MarkdownView): Promise<void> {
    return openVisualModeForActiveFile(this, view);
  }

  createNewDiagram(targetFolder?: string): Promise<void> {
    return createNewDiagram(this, targetFolder);
  }

  createDiagramFileWithTemplate(
    initialCode: string,
    targetFolder?: string
  ): Promise<void> {
    return createDiagramFileWithTemplate(this, initialCode, targetFolder);
  }

  insertMermaidDiagram(
    view: MarkdownView,
    template?: DiagramTemplate,
    openVisualMode = true
  ): Promise<void> {
    if (template) {
      return insertMermaidBlockAtCursor(this, view, template, openVisualMode);
    }
    return new Promise((resolve) => {
      new DiagramTemplateModal(this.app, (chosen) => {
        void insertMermaidBlockAtCursor(this, view, chosen, openVisualMode).then(
          () => resolve()
        );
      }).open();
    });
  }

  async loadSettings(): Promise<void> {
    const loaded: unknown = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, loaded as Partial<MerlaySettings>);
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}

export type { MerlayPlugin as VisualMermaidPlugin };
