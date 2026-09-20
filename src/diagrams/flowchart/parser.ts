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
  const { frontmatter, body } = splitFrontmatter(input);
  const tokens = tokenize(body);
  const inputLines = body.split('\n');
  let cursor = 0;

  const ast: MermaidFlowchartAST = {
    diagramType: 'flowchart',
    frontmatter,
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

    if (token.type === 'DIRECTION' && subgraphStack.length > 0) {
      const dirVal = advance().value as FlowchartDirection;
      const currentSubId = subgraphStack[subgraphStack.length - 1];
      if (ast.subgraphs.has(currentSubId)) {
        ast.subgraphs.get(currentSubId)!.direction = dirVal;
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
    if (token.type === 'IDENTIFIER') {
      parseNodeOrEdgeStatement();
      continue;
    }

    // Advance unknown tokens to avoid infinite loops
    advance();
  }

  // Resolve styles onto nodes and edges
  resolveStylesOntoAst(ast, pendingLinkStyles);

  return ast;

  function ensureNodeExists(nodeInfo: FlowchartNodeInfo) {
    const currentSubId = subgraphStack[subgraphStack.length - 1];
    ensureNodeInAst(ast, currentSubId, nodeInfo);
  }

  function parseNodeOrEdgeStatement() {
    const parsedLeft = parseSingleNode(tokens, cursor);
    if (!parsedLeft.node) return;
    cursor = parsedLeft.nextCursor;
    let leftNode = parsedLeft.node;

    ensureNodeExists(leftNode);

    // Check if followed by an arrow (Edge)
    while (currentToken().type === 'ARROW' || currentToken().type === 'ARROW_LABEL') {
      let arrowType: ArrowType = 'arrow';
      let edgeLabel: string | undefined;

      if (currentToken().type === 'ARROW_LABEL') {
        edgeLabel = advance().labelText;
      }

      if (currentToken().type === 'ARROW') {
        arrowType = mapArrowType(advance().value);
      }

      if (currentToken().type === 'ARROW_LABEL') {
        edgeLabel = advance().labelText;
      }

      const parsedRight = parseSingleNode(tokens, cursor);
      if (!parsedRight.node) break;
      cursor = parsedRight.nextCursor;
      const rightNode = parsedRight.node;

      ensureNodeExists(rightNode);

      const edgeDef: MermaidEdgeDef = {
        type: 'edge',
        id: `e_${leftNode.id}_${rightNode.id}_${ast.edges.length + 1}`,
        from: leftNode.id,
        to: rightNode.id,
        arrowType,
        label: edgeLabel,
      };

      ast.edges.push(edgeDef);
      leftNode = rightNode;
    }
  }
}
