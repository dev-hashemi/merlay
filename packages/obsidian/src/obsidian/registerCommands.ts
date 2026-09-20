import { MarkdownView } from 'obsidian';
import type MerlayPlugin from '../main';
import { DIAGRAM_TEMPLATES } from '@merlay/core';
import { insertMermaidBlockAtCursor } from './diagramOpener';
import { DiagramTemplateModal } from '../views/DiagramTemplateModal';

/**
 * Register palette and editor commands for Merlay.
 */
export function registerCommands(plugin: MerlayPlugin): void {
  // 1. Insert Mermaid Diagram (in active note at cursor)
  plugin.addCommand({
    id: 'insert-mermaid-diagram',
    name: 'Insert Mermaid diagram',
    editorCheckCallback: (checking, editor, view) => {
      if (!plugin.settings.enableInsertCommands) return false;
      if (view instanceof MarkdownView) {
        if (!checking) {
          new DiagramTemplateModal(plugin.app, (template) => {
            void insertMermaidBlockAtCursor(plugin, view, template, true);
          }).open();
        }
        return true;
      }
      return false;
    },
  });

  // 2. Dynamic insert commands for each template (direct slash command per type)
  for (const template of DIAGRAM_TEMPLATES) {
    plugin.addCommand({
      id: `insert-mermaid-${template.type.toLowerCase()}`,
      name: `Insert Mermaid diagram: ${template.label}`,
      editorCheckCallback: (checking, editor, view) => {
        if (!plugin.settings.enableInsertCommands) return false;
        if (view instanceof MarkdownView) {
          if (!checking) {
            void insertMermaidBlockAtCursor(plugin, view, template, true);
          }
          return true;
        }
        return false;
      },
    });
  }

  // 3. Create New Standalone Mermaid Diagram File (.mmd)
  plugin.addCommand({
    id: 'create-new-mermaid-diagram',
    name: 'Create new Mermaid diagram (file)',
    callback: () => {
      void plugin.createNewDiagram();
    },
  });

  // 4. Open Visual Mode for Current Diagram in Note
  plugin.addCommand({
    id: 'open-visual-mode-active-note',
    name: 'Open visual mode for current diagram',
    checkCallback: (checking) => {
      const view = plugin.app.workspace.getActiveViewOfType(MarkdownView);
      if (view) {
        if (!checking) {
          void plugin.openVisualModeForActiveFile(view);
        }
        return true;
      }
      return false;
    },
  });
}
