/**
 * Mermaid Class Diagram Tolerant Parser
 */

import { splitFrontmatter } from '../common/diagramHeader';
import { parseClassLine, parseMemberLine } from './lexer';
import {
  ClassKind,
  ClassNamespace,
  ClassNode,
  ClassRelationship,
  MermaidClassAST,
} from './types';

function parseStyleProperties(styleStr: string): Record<string, string> {
  const result: Record<string, string> = {};
  const pairs = styleStr.split(',');
  for (const pair of pairs) {
    const colonIdx = pair.indexOf(':');
    if (colonIdx !== -1) {
      const key = pair.slice(0, colonIdx).trim();
      const val = pair.slice(colonIdx + 1).trim();
      if (key && val) {
        result[key] = val;
      }
    }
  }
  return result;
}

function normalizeKind(stereotype: string): ClassKind {
  const lower = stereotype.toLowerCase();
  if (lower === 'interface') return 'interface';
  if (lower === 'abstract') return 'abstract';
  if (lower === 'service') return 'service';
  if (lower === 'enum' || lower === 'enumeration') return 'enum';
  return lower;
}

export function parseMermaidClassDiagram(input: string): MermaidClassAST {
  const { frontmatter, body } = splitFrontmatter(input);

  const ast: MermaidClassAST = {
    diagramType: 'classDiagram',
    frontmatter,
    direction: undefined,
    classes: new Map<string, ClassNode>(),
    relationships: [],
    namespaces: new Map<string, ClassNamespace>(),
    styles: [],
    rawLines: [],
  };

  const getOrCreateClass = (id: string, namespaceId?: string): ClassNode => {
    let cls = ast.classes.get(id);
    if (!cls) {
      cls = {
        id,
        label: id,
        kind: 'class',
        namespaceId,
        members: [],
        annotations: [],
      };
      ast.classes.set(id, cls);
      if (namespaceId) {
        const ns = ast.namespaces.get(namespaceId);
        if (ns && !ns.classIds.includes(id)) {
          ns.classIds.push(id);
        }
      }
    } else if (namespaceId && !cls.namespaceId) {
      cls.namespaceId = namespaceId;
      const ns = ast.namespaces.get(namespaceId);
      if (ns && !ns.classIds.includes(id)) {
        ns.classIds.push(id);
      }
    }
    return cls;
  };

  let currentNamespace: string | null = null;
  let currentClassBlock: {
    id: string;
    label?: string;
    style?: string;
  } | null = null;

  const lines = body.split('\n');
  let order = 0;

  for (let i = 0; i < lines.length; i++) {
    order++;
    const rawLine = lines[i];
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    // Inside a class block { ... }
    if (currentClassBlock) {
      if (trimmed === '}') {
        currentClassBlock = null;
        continue;
      }

      // Check if it's an internal stereotype e.g. <<interface>>
      const stereoMatch = trimmed.match(/^<<([A-Za-z0-9_-]+)>>$/);
      const cls = ast.classes.get(currentClassBlock.id);
      if (stereoMatch && cls) {
        const st = stereoMatch[1];
        cls.kind = normalizeKind(st);
        cls.annotations = cls.annotations || [];
        if (!cls.annotations.includes(st)) cls.annotations.push(st);
        continue;
      }

      // Unmodeled comment inside class block
      if (trimmed.startsWith('%%')) {
        ast.rawLines.push({
          raw: trimmed,
          namespaceId: currentNamespace || undefined,
          order,
        });
        continue;
      }

      // Class member
      if (cls) {
        cls.members.push(parseMemberLine(trimmed));
      }
      continue;
    }

    const token = parseClassLine(trimmed);

    switch (token.type) {
      case 'header': {
        ast.diagramType = token.headerType || 'classDiagram';
        break;
      }

      case 'direction': {
        ast.direction = token.direction;
        break;
      }

      case 'namespace_start': {
        currentNamespace = token.namespaceId || 'Namespace';
        if (!ast.namespaces.has(currentNamespace)) {
          ast.namespaces.set(currentNamespace, {
            id: currentNamespace,
            label: currentNamespace,
            classIds: [],
          });
        }
        break;
      }

      case 'block_end': {
        if (currentNamespace) {
          currentNamespace = null;
        }
        break;
      }

      case 'class_block_start': {
        const classId = token.classId!;
        const cls = getOrCreateClass(classId, currentNamespace || undefined);
        if (token.classLabel) cls.label = token.classLabel;
        if (token.classStyle) {
          cls.classes = cls.classes || [];
          if (!cls.classes.includes(token.classStyle)) cls.classes.push(token.classStyle);
        }
        currentClassBlock = {
          id: classId,
          label: token.classLabel,
          style: token.classStyle,
        };
        break;
      }

      case 'class_decl': {
        const classId = token.classId!;
        const cls = getOrCreateClass(classId, currentNamespace || undefined);
        if (token.classLabel) cls.label = token.classLabel;
        if (token.classStyle) {
          cls.classes = cls.classes || [];
          if (!cls.classes.includes(token.classStyle)) cls.classes.push(token.classStyle);
        }
        break;
      }

      case 'stereotype': {
        const targetId = token.targetId!;
        const st = token.stereotype!;
        const cls = getOrCreateClass(targetId, currentNamespace || undefined);
        cls.kind = normalizeKind(st);
        cls.annotations = cls.annotations || [];
        if (!cls.annotations.includes(st)) cls.annotations.push(st);
        break;
      }

      case 'member_single': {
        const classId = token.classId!;
        const cls = getOrCreateClass(classId, currentNamespace || undefined);
        if (token.member) {
          cls.members.push(token.member);
        }
        break;
      }

      case 'relationship': {
        const rel = token.relationship!;
        getOrCreateClass(rel.from, currentNamespace || undefined);
        getOrCreateClass(rel.to, currentNamespace || undefined);

        const edgeId = `rel_${rel.from}_${rel.to}_${ast.relationships.length}`;
        const newRel: ClassRelationship = {
          id: edgeId,
          from: rel.from,
          to: rel.to,
          leftEnd: rel.leftEnd,
          lineType: rel.lineType,
          rightEnd: rel.rightEnd,
          leftCardinality: rel.leftCardinality,
          rightCardinality: rel.rightCardinality,
          label: rel.label,
          rawRelation: rel.rawRelation,
        };
        ast.relationships.push(newRel);
        break;
      }

      case 'style': {
        const targetId = token.styleDeclaration!.targetId;
        const styles = parseStyleProperties(token.styleDeclaration!.styleString);
        ast.styles.push({ targetId, styles });
        const cls = ast.classes.get(targetId);
        if (cls) {
          cls.style = { ...(cls.style || {}), ...styles };
        }
        break;
      }

      case 'raw':
      default: {
        ast.rawLines.push({
          raw: trimmed,
          namespaceId: currentNamespace || undefined,
          order,
        });
        break;
      }
    }
  }

  return ast;
}
