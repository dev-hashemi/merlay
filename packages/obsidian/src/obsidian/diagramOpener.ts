/**
 * Diagram Opener and File Creator helpers for Obsidian Markdown integration
 */

import { MarkdownView, Notice } from 'obsidian';
import type MerlayPlugin from '../main';
import { findTargetMermaidBlock } from '@merlay/core';
import {
  detectDiagramType,
  isDiagramSupported,
  DIAGRAM_DISPLAY_NAMES,
  DiagramTemplate,
} from '@merlay/core';
import { MermaidBlockModal } from '../views/MermaidBlockModal';
import { DiagramTemplateModal } from '../views/DiagramTemplateModal';

export async function openVisualModeForActiveFile(
  plugin: MerlayPlugin,
  view: MarkdownView
): Promise<void> {
  const file = view.file;
  if (!file) return;
  const content = await plugin.app.vault.read(file);
  const cursorLine = view.editor.getCursor().line;

  const blockMatch = findTargetMermaidBlock({
    content,
    hintLine: cursorLine,
  });

  if (!blockMatch) {
    new Notice('No Mermaid code block found in active note.');
    return;
  }

  openDiagramModal(plugin, file.path, blockMatch, content);
}

export function openDiagramModal(
  plugin: MerlayPlugin,
  filePath: string,
  blockMatch: { rawCode: string; lineStart: number; lineEnd: number },
  content: string
): boolean {
  const rawCode = blockMatch.rawCode;
  const diagramType = detectDiagramType(rawCode);
  if (!isDiagramSupported(diagramType)) {
    const displayName = DIAGRAM_DISPLAY_NAMES[diagramType] || 'diagram';
    new Notice(
      `Viewing ${displayName} in View-Only mode. Visual editing is not yet supported for this diagram type.`,
      4000
    );
  }

  new MermaidBlockModal(
    plugin.app,
    plugin,
    filePath,
    {
      lineStart: blockMatch.lineStart,
      lineEnd: blockMatch.lineEnd,
    },
    rawCode
  ).open();
  return true;
}

export async function createNewDiagram(
  plugin: MerlayPlugin,
  targetFolder?: string
): Promise<void> {
  new DiagramTemplateModal(plugin.app, (template) => {
    void createDiagramFileWithTemplate(plugin, template.defaultCode, targetFolder);
  }).open();
}

export async function createDiagramFileWithTemplate(
  plugin: MerlayPlugin,
  initialCode: string,
  targetFolder?: string
): Promise<void> {
  try {
    let parentDir = targetFolder;
    if (parentDir === undefined) {
      const activeFile = plugin.app.workspace.getActiveFile();
      parentDir = activeFile?.parent ? activeFile.parent.path : '';
    }
    const baseName = 'New Diagram';
    let fileName = `${baseName}.mmd`;
    let counter = 1;

    while (
      plugin.app.vault.getAbstractFileByPath(
        parentDir ? `${parentDir}/${fileName}` : fileName
      )
    ) {
      fileName = `${baseName} ${counter++}.mmd`;
    }

    const fullPath = parentDir ? `${parentDir}/${fileName}` : fileName;
    const createdFile = await plugin.app.vault.create(fullPath, initialCode);
    const leaf = plugin.app.workspace.getLeaf('tab');
    await leaf.openFile(createdFile);

    new Notice(`Created diagram: ${fileName}`);
  } catch (e: unknown) {
    new Notice(`Error creating diagram: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export async function insertMermaidBlockAtCursor(
  plugin: MerlayPlugin,
  view: MarkdownView,
  template: DiagramTemplate,
  openVisualMode = true
): Promise<void> {
  const editor = view.editor;
  const cursor = editor.getCursor();
  const currentLineText = editor.getLine(cursor.line);

  const codeContent = template.defaultCode.trim();
  const blockText = `\`\`\`mermaid\n${codeContent}\n\`\`\``;

  let textToInsert = '';
  let insertFrom = cursor;
  let insertTo = cursor;
  let targetLineStart = cursor.line;

  if (currentLineText.trim().length === 0) {
    // Current line is blank: replace it with block + newline
    insertFrom = { line: cursor.line, ch: 0 };
    insertTo = { line: cursor.line, ch: currentLineText.length };
    textToInsert = `${blockText}\n`;
    targetLineStart = cursor.line;
  } else {
    // Current line has text: insert block separated by newlines
    textToInsert = `\n\n${blockText}\n`;
    targetLineStart = cursor.line + 2;
  }

  editor.replaceRange(textToInsert, insertFrom, insertTo);

  // Position cursor inside the diagram code block
  editor.setCursor({
    line: targetLineStart + 1,
    ch: 0,
  });

  if (openVisualMode && view.file) {
    try {
      await view.save();
      const content = await plugin.app.vault.read(view.file);
      const blockMatch = findTargetMermaidBlock({
        content,
        hintLine: targetLineStart,
      });

      if (blockMatch) {
        openDiagramModal(plugin, view.file.path, blockMatch, content);
      }
    } catch (err: unknown) {
      console.error('Failed to open visual mode after inserting diagram:', err);
    }
  }

  new Notice(`Inserted ${template.label}`);
}
