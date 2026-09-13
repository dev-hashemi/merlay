import { App, PluginSettingTab, Setting, setIcon } from 'obsidian';
import type { SettingDefinitionItem } from 'obsidian';
import type MerlayPlugin from '../main';
import { FlowchartDirection } from '../diagrams/viewModel';
import { MERLAY_ICON_ID } from '../obsidian/icons';

export interface MerlaySettings {
  defaultDirection: FlowchartDirection;
  showCodeDrawerByDefault: boolean;
  enableEditorContextMenu: boolean;
  enableFileContextMenu: boolean;
  enableInsertCommands: boolean;
}

export type VisualMermaidSettings = MerlaySettings;

export const DEFAULT_SETTINGS: MerlaySettings = {
  defaultDirection: 'LR',
  showCodeDrawerByDefault: false,
  enableEditorContextMenu: true,
  enableFileContextMenu: true,
  enableInsertCommands: true,
};

export class MerlaySettingTab extends PluginSettingTab {
  plugin: MerlayPlugin;

  constructor(app: App, plugin: MerlayPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  /**
   * Declarative settings (Obsidian 1.13+): feeds global settings search and
   * renders the tab on 1.13+, where `display()` is skipped. Mirrors
   * `display()` exactly — keep both in sync (same names, descriptions,
   * options). Controls bind to `this.plugin.settings[key]` via the default
   * `getControlValue`/`setControlValue`. `display()` below still serves
   * Obsidian < 1.13.
   */
  getSettingDefinitions(): SettingDefinitionItem[] {
    return [
      {
        name: '',
        searchable: false,
        render: (setting) => {
          // Banner row: hide the default info/control columns so the
          // branded header fills the row like in `display()`.
          setting.infoEl.hide();
          setting.controlEl.hide();
          const headerContainer = setting.settingEl.createDiv({
            cls: 'merlay-settings-header',
          });
          const logoEl = headerContainer.createDiv({ cls: 'merlay-settings-logo' });
          setIcon(logoEl, MERLAY_ICON_ID);
          const titleContainer = headerContainer.createDiv({
            cls: 'merlay-settings-title-group',
          });
          titleContainer.createDiv({ text: 'Merlay Settings', cls: 'merlay-settings-title' });
          titleContainer.createDiv({
            text: 'Visual overlay editor for Mermaid diagrams. Mermaid, your way.',
            cls: 'merlay-settings-subtitle',
          });
        },
      },
      {
        name: 'Default flow direction',
        desc: 'Default flow direction for newly created diagrams.',
        control: {
          type: 'dropdown',
          key: 'defaultDirection',
          defaultValue: 'LR',
          options: {
            LR: 'Left to right (lr)',
            TD: 'Top to bottom (td)',
            BT: 'Bottom to top (bt)',
            RL: 'Right to left (rl)',
          },
        },
      },
      {
        name: 'Show code drawer by default',
        desc: 'Displays the Mermaid syntax code drawer by default inside visual mode.',
        control: { type: 'toggle', key: 'showCodeDrawerByDefault' },
      },
      {
        type: 'group',
        heading: 'Commands & context menus',
        items: [
          {
            name: 'Editor context menu',
            desc: 'Show "insert Mermaid diagram" and "edit diagram in visual mode" in the note editor right-click menu.',
            control: { type: 'toggle', key: 'enableEditorContextMenu' },
          },
          {
            name: 'File explorer context menu',
            desc: 'Show "new Mermaid diagram" and "open in visual editor" in the file explorer right-click menu.',
            control: { type: 'toggle', key: 'enableFileContextMenu' },
          },
          {
            name: 'Insert diagram commands & slash commands',
            desc: 'Enable "insert Mermaid diagram" commands in the command palette and Obsidian slash (/) menu.',
            control: { type: 'toggle', key: 'enableInsertCommands' },
          },
        ],
      },
    ];
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    const headerContainer = containerEl.createDiv({ cls: 'merlay-settings-header' });
    const logoEl = headerContainer.createDiv({ cls: 'merlay-settings-logo' });
    setIcon(logoEl, MERLAY_ICON_ID);
    const titleContainer = headerContainer.createDiv({ cls: 'merlay-settings-title-group' });
    // Plain div (not a heading element): settings headings must not contain
    // the plugin name or the word "settings" per community review rules.
    titleContainer.createDiv({ text: 'Merlay Settings', cls: 'merlay-settings-title' });
    titleContainer.createDiv({
      text: 'Visual overlay editor for Mermaid diagrams. Mermaid, your way.',
      cls: 'merlay-settings-subtitle',
    });

    new Setting(containerEl)
      .setName('Default flow direction')
      .setDesc('Default flow direction for newly created diagrams.')
      .addDropdown((drop) =>
        drop
          .addOption('LR', 'Left to right (lr)')
          .addOption('TD', 'Top to bottom (td)')
          .addOption('BT', 'Bottom to top (bt)')
          .addOption('RL', 'Right to left (rl)')
          .setValue(this.plugin.settings.defaultDirection)
          .onChange(async (value) => {
            this.plugin.settings.defaultDirection = value as FlowchartDirection;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Show code drawer by default')
      .setDesc('Displays the Mermaid syntax code drawer by default inside visual mode.')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showCodeDrawerByDefault)
          .onChange(async (value) => {
            this.plugin.settings.showCodeDrawerByDefault = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl).setName('Commands & context menus').setHeading();

    new Setting(containerEl)
      .setName('Editor context menu')
      .setDesc('Show "insert Mermaid diagram" and "edit diagram in visual mode" in the note editor right-click menu.')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableEditorContextMenu)
          .onChange(async (value) => {
            this.plugin.settings.enableEditorContextMenu = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('File explorer context menu')
      .setDesc('Show "new Mermaid diagram" and "open in visual editor" in the file explorer right-click menu.')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableFileContextMenu)
          .onChange(async (value) => {
            this.plugin.settings.enableFileContextMenu = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Insert diagram commands & slash commands')
      .setDesc('Enable "insert Mermaid diagram" commands in the command palette and Obsidian slash (/) menu.')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableInsertCommands)
          .onChange(async (value) => {
            this.plugin.settings.enableInsertCommands = value;
            await this.plugin.saveSettings();
          })
      );
  }
}

