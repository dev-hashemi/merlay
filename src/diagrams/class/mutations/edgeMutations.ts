/**
 * Class Diagram Relationship / Edge Mutations
 */

import { ClassRelationship, MermaidClassAST } from '../types';
import { addClass } from './nodeMutations';

export function canConnectClasses(
  ast: MermaidClassAST,
  fromId: string,
  toId: string
): boolean {
  // Namespaces cannot be connection endpoints
  if (ast.namespaces.has(fromId) || ast.namespaces.has(toId)) {
    return false;
  }
  // Both endpoints must exist as classes
  return ast.classes.has(fromId) && ast.classes.has(toId);
}

export function connectClasses(
  ast: MermaidClassAST,
  fromId: string,
  toId: string
): void {
  if (!canConnectClasses(ast, fromId, toId)) return;

  const edgeId = `rel_${fromId}_${toId}_${ast.relationships.length}`;
  const rel: ClassRelationship = {
    id: edgeId,
    from: fromId,
    to: toId,
    leftEnd: '<|',
    lineType: '--',
    rightEnd: undefined,
    rawRelation: '<|--',
  };

  ast.relationships.push(rel);
}

export function updateRelationshipType(
  ast: MermaidClassAST,
  edgeId: string,
  type: string
): void {
  const rel = ast.relationships.find((r) => r.id === edgeId);
  if (!rel) return;

  switch (type) {
    case 'arrow':
      // Inheritance: <|--
      rel.leftEnd = '<|';
      rel.lineType = '--';
      rel.rightEnd = undefined;
      rel.rawRelation = '<|--';
      break;
    case 'open':
      // Association: -->
      rel.leftEnd = undefined;
      rel.lineType = '--';
      rel.rightEnd = '>';
      rel.rawRelation = '-->';
      break;
    case 'dotted':
      // Realization: ..|>
      rel.leftEnd = undefined;
      rel.lineType = '..';
      rel.rightEnd = '|>';
      rel.rawRelation = '..|>';
      break;
    case 'thick':
      // Composition: *--
      rel.leftEnd = '*';
      rel.lineType = '--';
      rel.rightEnd = undefined;
      rel.rawRelation = '*--';
      break;
    case 'bidirectional':
      // Bidirectional Association: <-->
      rel.leftEnd = '<';
      rel.lineType = '--';
      rel.rightEnd = '>';
      rel.rawRelation = '<-->';
      break;
    default:
      break;
  }
}

export function deleteRelationship(ast: MermaidClassAST, edgeId: string): void {
  ast.relationships = ast.relationships.filter((rel) => rel.id !== edgeId);
}

export function deleteRelationships(
  ast: MermaidClassAST,
  edgeIds: Iterable<string>
): void {
  const toDelete = new Set(edgeIds);
  ast.relationships = ast.relationships.filter((rel) => !toDelete.has(rel.id));
}

export function updateRelationshipLabel(
  ast: MermaidClassAST,
  edgeId: string,
  label: string
): void {
  const rel = ast.relationships.find((r) => r.id === edgeId);
  if (!rel) return;
  rel.label = label;
}

function reverseArrowHead(head?: string): string | undefined {
  if (!head) return undefined;
  if (head === '<|') return '|>';
  if (head === '|>') return '<|';
  if (head === '<') return '>';
  if (head === '>') return '<';
  return head; // * or o remain the same
}

export function reverseRelationship(
  ast: MermaidClassAST,
  edgeId: string
): string | null {
  const rel = ast.relationships.find((r) => r.id === edgeId);
  if (!rel) return null;

  const oldFrom = rel.from;
  rel.from = rel.to;
  rel.to = oldFrom;

  const oldLeftEnd = rel.leftEnd;
  const oldRightEnd = rel.rightEnd;
  rel.leftEnd = reverseArrowHead(oldRightEnd);
  rel.rightEnd = reverseArrowHead(oldLeftEnd);

  const oldLeftCard = rel.leftCardinality;
  rel.leftCardinality = rel.rightCardinality;
  rel.rightCardinality = oldLeftCard;

  rel.rawRelation = `${rel.leftEnd || ''}${rel.lineType}${rel.rightEnd || ''}`;
  return rel.id;
}

export function insertClassOnRelationship(
  ast: MermaidClassAST,
  edgeId: string,
  label: string
): string | null {
  const relIndex = ast.relationships.findIndex((r) => r.id === edgeId);
  if (relIndex === -1) return null;

  const rel = ast.relationships[relIndex];
  const fromClass = ast.classes.get(rel.from);
  const toClass = ast.classes.get(rel.to);

  // If both belong to the same namespace, keep the intermediate in that namespace
  const sharedNs =
    fromClass?.namespaceId && fromClass.namespaceId === toClass?.namespaceId
      ? fromClass.namespaceId
      : undefined;

  const intermediateId = addClass(ast, label, 'class', sharedNs);

  const edge1Id = `rel_${rel.from}_${intermediateId}_${ast.relationships.length}`;
  const edge2Id = `rel_${intermediateId}_${rel.to}_${ast.relationships.length + 1}`;

  const edge1: ClassRelationship = {
    id: edge1Id,
    from: rel.from,
    to: intermediateId,
    leftEnd: undefined,
    lineType: rel.lineType,
    rightEnd: '>',
    rawRelation: rel.lineType === '..' ? '..>' : '-->',
  };

  const edge2: ClassRelationship = {
    id: edge2Id,
    from: intermediateId,
    to: rel.to,
    leftEnd: rel.leftEnd,
    lineType: rel.lineType,
    rightEnd: rel.rightEnd,
    leftCardinality: undefined,
    rightCardinality: rel.rightCardinality,
    label: rel.label,
    rawRelation: rel.rawRelation,
  };

  ast.relationships.splice(relIndex, 1, edge1, edge2);
  return intermediateId;
}
