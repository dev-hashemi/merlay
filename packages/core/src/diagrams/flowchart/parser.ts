/**
 * Parser for Mermaid Flowcharts
 */

import { Token, tokenize } from './lexer';
import { splitFrontmatter } from '../common/diagramHeader';
import {
  ArrowType,
  FlowchartDirection,
  MermaidEdgeDef,
  MermaidFlowchartAST,
  MermaidSubgraphDef,
} from './types';
import {
  parseStyleDeclarations,
  mapArrowType,
  parseArrowDetails,
  resolveStylesOntoAst,
  PendingLinkStyle,
} from './styleParser';
import {
  ensureNodeInAst,
  parseSingleNode,
  FlowchartNodeInfo,
} from './parserNodes';
import { tryConsumeRawStatement } from './parserRawStatements';
import {
  parseStyleStatement,
  parseLinkStyleStatement,
  parseClassDefStatement,
  parseClassAssignmentStatement,
} from './parserStyleStatements';

export { parseStyleDeclarations };

export function parseMermaidFlowchart(input: string): MermaidFlowchartAST {
  const { frontmatter, directives, body } = splitFrontmatter(input);
  const tokens = tokenize(body);
  const inputLines = body.split('\n');
  let cursor = 0;

  const ast: MermaidFlowchartAST = {
    diagramType: 'flowchart',
    frontmatter,
    directives,
    direction: 'TD',
    nodes: new Map(),
    edges: [],
    subgraphs: new Map(),
    styles: [],
    classDefs: new Map(),
    rawLines: [],
  };

  const subgraphStack: string[] = [];

  function currentToken(): Token {
    return tokens[cursor] || { type: 'EOF', value: '', line: -1, col: -1 };
  }

  function advance(): Token {
    const t = currentToken();
    cursor++;
    return t;
  }

  function skipNewlines() {
    while (currentToken().type === 'NEWLINE') {
      advance();
    }
  }

  // Parse header
  skipNewlines();
  while (currentToken().type === 'COMMENT') {
    ast.rawLines.push({ type: 'raw', text: advance().value });
    skipNewlines();
  }
  if (currentToken().type === 'DIRECTIVE') {
    const dirToken = advance();
    ast.diagramType = dirToken.value.toLowerCase() as 'flowchart' | 'graph';

    if (currentToken().type === 'DIRECTION') {
      ast.direction = advance().value as FlowchartDirection;
    }
  }

  const pendingLinkStyles: PendingLinkStyle[] = [];

  while (cursor < tokens.length && currentToken().type !== 'EOF') {
    skipNewlines();
    if (currentToken().type === 'EOF') break;

    const token = currentToken();

    // 1. Comments — preserved verbatim so visual edits never drop them
    if (token.type === 'COMMENT') {
      const t = advance();
      ast.rawLines.push({ type: 'raw', text: t.value });
      continue;
    }

    // 2. Subgraph start
    if (token.type === 'SUBGRAPH') {
      advance(); // consume 'subgraph'
      let subId = '';
      let subLabel = '';

      if (currentToken().type === 'IDENTIFIER') {
        subId = advance().value;
      }
      if (currentToken().type === 'NODE_SHAPE') {
        subLabel = currentToken().labelText || '';
        advance();
      } else if (!subLabel && subId) {
        subLabel = subId;
      }

      if (!subId) {
        subId = `sub_${ast.subgraphs.size + 1}`;
      }

      const parentSubId = subgraphStack[subgraphStack.length - 1];
      const subgraphDef: MermaidSubgraphDef = {
        type: 'subgraph',
        id: subId,
        label: subLabel || subId,
        nodeIds: [],
        subgraphIds: [],
      };

      ast.subgraphs.set(subId, subgraphDef);
      if (parentSubId && ast.subgraphs.has(parentSubId)) {
        ast.subgraphs.get(parentSubId)!.subgraphIds.push(subId);
      }

      subgraphStack.push(subId);
      continue;
    }

    // 3. Subgraph end
    if (token.type === 'END') {
      advance();
      subgraphStack.pop();
      continue;
    }

    // 4. Direction keyword (direction TB / direction LR)
    if (token.type === 'DIRECTION_KEYWORD') {
      advance(); // consume 'direction'
      if (currentToken().type === 'DIRECTION') {
        const dirVal = advance().value as FlowchartDirection;
        const currentSubId = subgraphStack[subgraphStack.length - 1];
        if (currentSubId && ast.subgraphs.has(currentSubId)) {
          ast.subgraphs.get(currentSubId)!.direction = dirVal;
        } else {
          ast.direction = dirVal;
        }
      }
      continue;
    }

    // 5. Style definition: style NodeID fill:#...,stroke:#...
    if (token.type === 'STYLE') {
      cursor = parseStyleStatement(tokens, cursor, ast);
      continue;
    }

    // 5.b LinkStyle definition: linkStyle 0 stroke:#...,stroke-width:...
    if (token.type === 'LINK_STYLE') {
      cursor = parseLinkStyleStatement(tokens, cursor, pendingLinkStyles);
      continue;
    }

    // 6. Class definition: classDef name fill:#...
    if (token.type === 'CLASS_DEF') {
      cursor = parseClassDefStatement(tokens, cursor, ast);
      continue;
    }

    // 6.b Class assignment: class Node1,Node2 className
    if (token.type === 'CLASS') {
      const currentSubId = subgraphStack[subgraphStack.length - 1];
      cursor = parseClassAssignmentStatement(tokens, cursor, ast, currentSubId);
      continue;
    }

    // 7. Interaction / metadata statements the editor does not model
    // (click, accTitle, accDescr, title) — preserved verbatim so visual
    // edits never corrupt or drop hand-written code.
    if (token.type === 'IDENTIFIER') {
      const rawCursor = tryConsumeRawStatement(tokens, cursor, inputLines, ast);
      if (rawCursor !== null) {
        cursor = rawCursor;
        continue;
      }
    }

    // 8. Node / Edge statements
    if (token.type === 'IDENTIFIER' || token.type === 'DIRECTION') {
      parseNodeOrEdgeStatement();
      continue;
    }

    // Advance unknown tokens to avoid infinite loops
    advance();
  }

  // Resolve styles onto nodes and edges
  resolveStylesOntoAst(ast, pendingLinkStyles);

  // Prune any bare placeholder node whose id matches an actual subgraph
  for (const subId of ast.subgraphs.keys()) {
    const node = ast.nodes.get(subId);
    if (
      node &&
      (!node.shape || node.shape === 'rectangle') &&
      (!node.label || node.label === subId)
    ) {
      ast.nodes.delete(subId);
    }
  }

  return ast;

  function ensureNodeExists(nodeInfo: FlowchartNodeInfo) {
    const currentSubId = subgraphStack[subgraphStack.length - 1];
    ensureNodeInAst(ast, currentSubId, nodeInfo);
  }

  function parseNodeGroup(): FlowchartNodeInfo[] {
    const group: FlowchartNodeInfo[] = [];
    const parsedFirst = parseSingleNode(tokens, cursor);
    if (!parsedFirst.node) return group;
    cursor = parsedFirst.nextCursor;
    ensureNodeExists(parsedFirst.node);
    group.push(parsedFirst.node);

    while (currentToken().type === 'AND') {
      advance(); // consume '&'
      const parsedNext = parseSingleNode(tokens, cursor);
      if (!parsedNext.node) break;
      cursor = parsedNext.nextCursor;
      ensureNodeExists(parsedNext.node);
      group.push(parsedNext.node);
    }
    return group;
  }

  function parseNodeOrEdgeStatement() {
    let leftNodes = parseNodeGroup();
    if (leftNodes.length === 0) return;

    // Check if followed by an arrow (Edge)
    while (currentToken().type === 'ARROW' || currentToken().type === 'ARROW_LABEL') {
      let arrowType: ArrowType = 'arrow';
      let edgeLength: number | undefined;
      let edgeLabel: string | undefined;

      if (currentToken().type === 'ARROW_LABEL') {
        edgeLabel = advance().labelText;
      }

      if (currentToken().type === 'ARROW') {
        const details = parseArrowDetails(advance().value);
        arrowType = details.arrowType;
        if (details.length > 1) {
          edgeLength = details.length;
        }
      }

      if (currentToken().type === 'ARROW_LABEL') {
        edgeLabel = advance().labelText;
      }

      const rightNodes = parseNodeGroup();
      if (rightNodes.length === 0) break;

      for (const leftNode of leftNodes) {
        for (const rightNode of rightNodes) {
          const edgeDef: MermaidEdgeDef = {
            type: 'edge',
            id: `e_${leftNode.id}_${rightNode.id}_${ast.edges.length + 1}`,
            from: leftNode.id,
            to: rightNode.id,
            arrowType,
            label: edgeLabel,
            length: edgeLength,
          };

          ast.edges.push(edgeDef);
        }
      }

      leftNodes = rightNodes;
    }
  }
}
