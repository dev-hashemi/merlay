export {
  splitFrontmatter,
  findFirstCodeLine,
  matchesHeader,
  emitFrontmatter,
  emitDirectives,
  generateUniqueId,
  getDiagramTheme,
  setDiagramTheme,
  getDiagramTitle,
  setDiagramTitle,
  MERMAID_THEMES,
} from './diagramHeader';
export type { SplitFrontmatterResult, MermaidTheme } from './diagramHeader';
export {
  parseSequenceNote,
  formatSequenceNote,
  parseStateNoteLine,
  formatStateNote,
  parseClassNoteLine,
  formatClassNote,
  findNotesForTarget,
  updateNoteInRawLines,
} from './diagramNotes';
export type { NotePosition, DiagramNoteDetails } from './diagramNotes';

