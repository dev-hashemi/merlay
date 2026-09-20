import {
  MarkdownView,
  TFile,
  TFolder,
  Menu,
  MenuItem,
} from 'obsidian';
import type MerlayPlugin from '../main';
import { DIAGRAM_TEMPLATES, isCursorInMermaidBlock } from '@merlay/core';
import {
  openDiagramModal,
  insertMermaidBlockAtCursor,
  createDiagramFileWithTemplate,
} from './diagramOpener';
import { DiagramTemplateModal } from '../views/DiagramTemplateModal';
import { MERLAY_ICON_ID } from './icons';

/** Newer Obsidian MenuItem with submenu support (absent from current typings). */
type MenuItemWithSubmenu = MenuItem & { setSubmenu?: () => Menu };

/**
 * Register editor and file-explorer context menus for Merlay.
 */
export function registerContextMenus(plugin: MerlayPlugin): void {
  // 1. Editor Context Menu (inside markdown notes)
  plugin.registerEvent(
    plugin.app.workspace.on('editor-menu', (menu, editor, info) => {
      if (!plugin.settings.enableEditorContextMenu) return;

      const view =
        info instanceof MarkdownView
          ? info
          : plugin.app.workspace.getActiveViewOfType(MarkdownView);

      const cursor = editor.getCursor();
      const content = editor.getValue();
      const blockInCursor = isCursorInMermaidBlock(content, cursor.line);

      // If right-clicked directly inside an existing Mermaid diagram block
      if (blockInCursor && view?.file) {
        menu.addItem((item) => {
          item
            .setTitle('Edit diagram in visual mode')
            .setIcon(MERLAY_ICON_ID)
            .setSection('action')
            .onClick(() => {
              openDiagramModal(
                plugin,
                view.file!.path,
                blockInCursor,
                content
              );
            });
        });
        menu.addSeparator();
      }

      // Insert Mermaid Diagram option (with submenu if supported)
      menu.addItem((item) => {
        item
          .setTitle('Insert Mermaid diagram')
          .setIcon(MERLAY_ICON_ID)
          .setSection('action');

        const submenu =
          typeof (item as MenuItemWithSubmenu).setSubmenu === 'function'
            ? (item as MenuItemWithSubmenu).setSubmenu!()
            : null;

        if (submenu && view) {
          submenu.addItem((subItem: MenuItem) => {
            subItem
              .setTitle('Choose template...')
              .setIcon('list')
              .onClick(() => {
                new DiagramTemplateModal(plugin.app, (template) => {
                  void insertMermaidBlockAtCursor(plugin, view, template, true);
                }).open();
              });
          });

          submenu.addSeparator();

          for (const template of DIAGRAM_TEMPLATES) {
            submenu.addItem((subItem: MenuItem) => {
              subItem
                .setTitle(template.label)
                .setIcon(
                  template.type === 'flowchart' ? 'git-fork' : 'git-commit'
                )
                .onClick(() => {
                  void insertMermaidBlockAtCursor(plugin, view, template, true);
                });
            });
          }
        } else {
          item.onClick(() => {
            if (view) {
              new DiagramTemplateModal(plugin.app, (template) => {
                void insertMermaidBlockAtCursor(plugin, view, template, true);
              }).open();
            }
          });
        }
      });
    })
  );

  // 2. File Explorer Context Menu (folders and files)
  plugin.registerEvent(
    plugin.app.workspace.on('file-menu', (menu, file, source, leaf) => {
      if (!plugin.settings.enableFileContextMenu) return;

      // If right-clicked on an existing .mmd or .mermaid file, offer to open in visual editor
      if (
        file instanceof TFile &&
        (file.extension === 'mmd' || file.extension === 'mermaid')
      ) {
        menu.addItem((item) => {
          item
            .setTitle('Open in visual editor')
            .setIcon(MERLAY_ICON_ID)
            .setSection('open')
            .onClick(async () => {
              const targetLeaf = leaf || plugin.app.workspace.getLeaf('tab');
              await targetLeaf.openFile(file);
            });
        });
        return;
      }

      // Determine target folder
      let targetFolder = '';
      if (file instanceof TFolder) {
        targetFolder = file.path;
      } else if (file instanceof TFile) {
        targetFolder = file.parent ? file.parent.path : '';
      }

      menu.addItem((item) => {
        item
          .setTitle('New Mermaid diagram')
          .setIcon(MERLAY_ICON_ID)
          .setSection('action');

        const submenu =
          typeof (item as MenuItemWithSubmenu).setSubmenu === 'function'
            ? (item as MenuItemWithSubmenu).setSubmenu!()
            : null;

        if (submenu) {
          submenu.addItem((subItem: MenuItem) => {
            subItem
              .setTitle('Choose template...')
              .setIcon('list')
              .onClick(() => {
                new DiagramTemplateModal(plugin.app, (template) => {
                  void createDiagramFileWithTemplate(
                    plugin,
                    template.defaultCode,
                    targetFolder
                  );
                }).open();
              });
          });

          submenu.addSeparator();

          for (const template of DIAGRAM_TEMPLATES) {
            submenu.addItem((subItem: MenuItem) => {
              subItem
                .setTitle(template.label)
                .setIcon(
                  template.type === 'flowchart' ? 'git-fork' : 'git-commit'
                )
                .onClick(() => {
                  void createDiagramFileWithTemplate(
                    plugin,
                    template.defaultCode,
                    targetFolder
                  );
                });
            });
          }
        } else {
          item.onClick(() => {
            new DiagramTemplateModal(plugin.app, (template) => {
              void createDiagramFileWithTemplate(
                plugin,
                template.defaultCode,
                targetFolder
              );
            }).open();
          });
        }
      });
    })
  );
}
