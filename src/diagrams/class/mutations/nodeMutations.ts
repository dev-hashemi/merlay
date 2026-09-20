/**
 * Class Diagram Node Mutations
 */

import { generateUniqueId } from '../../common/diagramHeader';
import { ClassKind, ClassMember, ClassNode, ClassRelationship, MermaidClassAST } from '../types';
import { parseMemberLine } from '../lexer';
import { NodeMemberCapabilities, NodeMembersGroup } from '../../types';

export function addClass(
  ast: MermaidClassAST,
  label: string,
  kind?: ClassKind,
  namespaceId?: string
): string {
  const existingIds = new Set(ast.classes.keys());
  const id = generateUniqueId(existingIds, 'Class');

  const annotations: string[] = [];
  if (kind && kind !== 'class') {
    annotations.push(kind);
  }

  const cls: ClassNode = {
    id,
    label: label || id,
    kind: kind || 'class',
    namespaceId,
    members: [],
    annotations,
  };

  ast.classes.set(id, cls);

  if (namespaceId) {
    const ns = ast.namespaces.get(namespaceId);
    if (ns && !ns.classIds.includes(id)) {
      ns.classIds.push(id);
    }
  }

  return id;
}

export function addChildClass(
  ast: MermaidClassAST,
  parentId: string,
  label: string,
  kind?: ClassKind
): string {
  const parent = ast.classes.get(parentId);
  const childId = addClass(ast, label, kind, parent?.namespaceId);

  // Sprouting in a class diagram establishes inheritance: Parent <|-- Child
  const edgeId = `rel_${parentId}_${childId}_${ast.relationships.length}`;
  const rel: ClassRelationship = {
    id: edgeId,
    from: parentId,
    to: childId,
    leftEnd: '<|',
    lineType: '--',
    rightEnd: undefined,
    rawRelation: '<|--',
  };

  ast.relationships.push(rel);
  return childId;
}

export function deleteClass(ast: MermaidClassAST, classId: string): void {
  ast.classes.delete(classId);

  // Cascade delete incident relationships
  ast.relationships = ast.relationships.filter(
    (rel) => rel.from !== classId && rel.to !== classId
  );

  // Remove from namespaces
  for (const ns of ast.namespaces.values()) {
    ns.classIds = ns.classIds.filter((id) => id !== classId);
  }

  // Remove styles
  ast.styles = ast.styles.filter((s) => s.targetId !== classId);
}

export function deleteClasses(ast: MermaidClassAST, classIds: Iterable<string>): void {
  const toDelete = new Set(classIds);
  for (const id of toDelete) {
    ast.classes.delete(id);
  }
  ast.relationships = ast.relationships.filter(
    (rel) => !toDelete.has(rel.from) && !toDelete.has(rel.to)
  );
  for (const ns of ast.namespaces.values()) {
    ns.classIds = ns.classIds.filter((id) => !toDelete.has(id));
  }
  ast.styles = ast.styles.filter((s) => !toDelete.has(s.targetId));
}

export function updateClassLabel(
  ast: MermaidClassAST,
  classId: string,
  label: string
): void {
  const cls = ast.classes.get(classId);
  if (!cls) return;
  cls.label = label;
}

export function isClassTextEditable(cls?: ClassNode): boolean {
  return true;
}

export function updateClassKind(
  ast: MermaidClassAST,
  classId: string,
  kind: string
): void {
  const cls = ast.classes.get(classId);
  if (!cls) return;
  cls.kind = kind as ClassKind;
  if (kind === 'class') {
    cls.annotations = [];
  } else {
    cls.annotations = [kind];
  }
}

export function updateClassesKind(
  ast: MermaidClassAST,
  classIds: Iterable<string>,
  kind: string
): void {
  for (const id of classIds) {
    updateClassKind(ast, id, kind);
  }
}

export function isClassMethod(rawOrText: string): boolean {
  return rawOrText.includes('(');
}

export function getClassMemberCapabilities(
  ast: MermaidClassAST,
  classId: string
): NodeMemberCapabilities {
  const cls = ast.classes.get(classId);
  const kind = cls?.kind || 'class';

  switch (kind) {
    case 'interface':
      return {
        supportsAttributes: false,
        supportsMethods: true,
        attributeLabel: 'Attribute',
        methodLabel: 'Method',
      };
    case 'service':
      return {
        supportsAttributes: false,
        supportsMethods: true,
        attributeLabel: 'Attribute',
        methodLabel: 'Method',
      };
    case 'enum':
      return {
        supportsAttributes: true,
        supportsMethods: false,
        attributeLabel: 'Value',
        methodLabel: 'Method',
      };
    case 'abstract':
    case 'class':
    default:
      return {
        supportsAttributes: true,
        supportsMethods: true,
        attributeLabel: 'Attribute',
        methodLabel: 'Method',
      };
  }
}

export function getClassMembers(
  ast: MermaidClassAST,
  classId: string
): NodeMembersGroup {
  const cls = ast.classes.get(classId);
  if (!cls) return { attributes: [], methods: [] };

  const attributes: string[] = [];
  const methods: string[] = [];

  for (const m of cls.members) {
    if (isClassMethod(m.raw)) {
      methods.push(m.raw);
    } else {
      attributes.push(m.raw);
    }
  }

  return { attributes, methods };
}

export function formatClassMemberInput(
  rawText: string,
  kind: 'attribute' | 'method',
  isEnum?: boolean
): string {
  let trimmed = rawText.trim();
  if (!trimmed) return '';

  // Enum attributes/values don't require visibility prefix or parens
  if (isEnum && kind === 'attribute') {
    return trimmed;
  }

  // 1. Visibility: ensure +, -, #, or ~
  const hasVis = /^[-+#~]/.test(trimmed);
  if (!hasVis) {
    trimmed = `+${trimmed}`;
  }

  // 2. Methods: ensure ()
  if (kind === 'method') {
    if (!trimmed.includes('(')) {
      let suffix = '';
      if (trimmed.endsWith('*') || trimmed.endsWith('$')) {
        suffix = trimmed.slice(-1);
        trimmed = trimmed.slice(0, -1).trim();
      }

      const colonIdx = trimmed.indexOf(':');
      if (colonIdx !== -1) {
        const namePart = trimmed.slice(0, colonIdx).trim();
        const returnPart = trimmed.slice(colonIdx).trim();
        trimmed = `${namePart}() ${returnPart}${suffix}`;
      } else {
        trimmed = `${trimmed}()${suffix}`;
      }
    }
  }

  return trimmed;
}

export function setClassMembers(
  ast: MermaidClassAST,
  classId: string,
  kind: 'attribute' | 'method',
  lines: string[]
): void {
  const cls = ast.classes.get(classId);
  if (!cls) return;

  const caps = getClassMemberCapabilities(ast, classId);
  if (kind === 'attribute' && !caps.supportsAttributes) return;
  if (kind === 'method' && !caps.supportsMethods) return;

  const isEnum = cls.kind === 'enum';

  // Format non-empty lines
  const newFormattedMembers: ClassMember[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const formatted = formatClassMemberInput(trimmed, kind, isEnum);
    if (formatted) {
      newFormattedMembers.push(parseMemberLine(formatted));
    }
  }

  // Preserve the other compartment's members
  const otherMembers: ClassMember[] = [];
  for (const m of cls.members) {
    const isM = isClassMethod(m.raw);
    if ((kind === 'attribute' && isM) || (kind === 'method' && !isM)) {
      otherMembers.push(m);
    }
  }

  if (kind === 'attribute') {
    cls.members = [...newFormattedMembers, ...otherMembers];
  } else {
    cls.members = [...otherMembers, ...newFormattedMembers];
  }
}

export function addClassMember(
  ast: MermaidClassAST,
  classId: string,
  kind: 'attribute' | 'method',
  rawText?: string,
  afterIndex?: number
): void {
  const cls = ast.classes.get(classId);
  if (!cls) return;

  const caps = getClassMemberCapabilities(ast, classId);
  if (kind === 'attribute' && !caps.supportsAttributes) return;
  if (kind === 'method' && !caps.supportsMethods) return;

  let text = rawText?.trim();
  if (!text) {
    if (kind === 'method') {
      text = cls.kind === 'abstract' ? '+newMethod()*' : '+newMethod()';
    } else {
      text = cls.kind === 'enum' ? 'NEW_VALUE' : '+newAttr';
    }
  } else {
    text = formatClassMemberInput(text, kind, cls.kind === 'enum');
  }

  const newMember = parseMemberLine(text);

  // If afterIndex is provided, find that compartment's item and insert after it
  if (afterIndex !== undefined && afterIndex >= 0) {
    let count = 0;
    let insertAt = -1;
    for (let i = 0; i < cls.members.length; i++) {
      const isM = isClassMethod(cls.members[i].raw);
      if ((kind === 'method' && isM) || (kind === 'attribute' && !isM)) {
        if (count === afterIndex) {
          insertAt = i + 1;
          break;
        }
        count++;
      }
    }
    if (insertAt !== -1) {
      cls.members.splice(insertAt, 0, newMember);
      return;
    }
  }

  // Otherwise, insert at end of the appropriate compartment:
  // In Mermaid class diagrams: attributes come first, methods come second.
  if (kind === 'attribute') {
    let lastAttrIdx = -1;
    for (let i = 0; i < cls.members.length; i++) {
      if (!isClassMethod(cls.members[i].raw)) {
        lastAttrIdx = i;
      }
    }
    if (lastAttrIdx !== -1) {
      cls.members.splice(lastAttrIdx + 1, 0, newMember);
    } else {
      cls.members.unshift(newMember);
    }
  } else {
    cls.members.push(newMember);
  }
}

export function updateClassMember(
  ast: MermaidClassAST,
  classId: string,
  kind: 'attribute' | 'method',
  index: number,
  rawText: string
): void {
  const cls = ast.classes.get(classId);
  if (!cls) return;

  const trimmed = rawText.trim();
  // If text is cleared completely, delete the row
  if (!trimmed) {
    deleteClassMember(ast, classId, kind, index);
    return;
  }

  let count = 0;
  for (let i = 0; i < cls.members.length; i++) {
    const isM = isClassMethod(cls.members[i].raw);
    if ((kind === 'method' && isM) || (kind === 'attribute' && !isM)) {
      if (count === index) {
        const formatted = formatClassMemberInput(trimmed, kind, cls.kind === 'enum');
        cls.members[i] = parseMemberLine(formatted);
        return;
      }
      count++;
    }
  }
}

export function deleteClassMember(
  ast: MermaidClassAST,
  classId: string,
  kind: 'attribute' | 'method',
  index: number
): void {
  const cls = ast.classes.get(classId);
  if (!cls) return;

  let count = 0;
  for (let i = 0; i < cls.members.length; i++) {
    const isM = isClassMethod(cls.members[i].raw);
    if ((kind === 'method' && isM) || (kind === 'attribute' && !isM)) {
      if (count === index) {
        cls.members.splice(i, 1);
        return;
      }
      count++;
    }
  }
}
