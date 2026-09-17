/**
 * Parser for Mermaid Flowcharts
 */

import { Token, tokenize } from './lexer';
import {
  ArrowType,
  FlowchartDirection,
  MermaidEdgeDef,
  MermaidFlowchartAST,
  MermaidNodeDef,
  MermaidShapeType,
  MermaidSubgraphDef,
} from './types';
import {
  parseStyleDeclarations,
  mapArrowType,
  resolveStylesOntoAst,
} from './styleParser';

export { parseStyleDeclarations };

export function parseMermaidFlowchart(input: string): MermaidFlowchartAST {
  const tokens = tokenize(input);
  const inputLines = input.split('\n');
  let cursor = 0;

  const ast: MermaidFlowchartAST = {
    diagramType: 'flowchart',
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

  const pendingLinkStyles: Array<{ targetSpec: string; styleMap: Record<string, string> }> = [];

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
      advance(); // consume 'style'
      const lineTokens: Token[] = [];
      while (
        currentToken().type !== 'NEWLINE' &&
        currentToken().type !== 'EOF'
      ) {
        lineTokens.push(advance());
      }

      const fullLine = lineTokens.map((t) => t.value).join(' ').trim();
      const firstColon = fullLine.indexOf(':');
      if (firstColon !== -1) {
        const beforeColon = fullLine.substring(0, firstColon);
        const lastSpace = beforeColon.lastIndexOf(' ');
        let targetsStr = '';
        let styleStr = '';

        if (lastSpace !== -1) {
          targetsStr = beforeColon.substring(0, lastSpace).trim();
          styleStr = fullLine.substring(lastSpace + 1).trim();
        } else {
          targetsStr = beforeColon.trim();
          styleStr = fullLine.substring(firstColon + 1).trim();
        }

        const styleMap = parseStyleDeclarations(styleStr);
        const targetIds = targetsStr
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean);

        for (const targetId of targetIds) {
          if (targetId.toLowerCase() === 'default') {
            if (!ast.classDefs.has('default')) {
              ast.classDefs.set('default', {
                type: 'classDef',
                name: 'default',
                styles: { ...styleMap },
              });
            } else {
              Object.assign(ast.classDefs.get('default')!.styles, styleMap);
            }
          } else {
            const existingStyleIndex = ast.styles.findIndex(
              (s) => s.targetId === targetId
            );
            if (existingStyleIndex !== -1) {
              ast.styles[existingStyleIndex].styles = {
                ...ast.styles[existingStyleIndex].styles,
                ...styleMap,
              };
            } else {
              ast.styles.push({
                type: 'style',
                targetId,
                styles: { ...styleMap },
              });
            }

            if (ast.nodes.has(targetId)) {
              ast.nodes.get(targetId)!.style = {
                ...(ast.nodes.get(targetId)!.style || {}),
                ...styleMap,
              };
            }
            if (ast.subgraphs.has(targetId)) {
              ast.subgraphs.get(targetId)!.style = {
                ...(ast.subgraphs.get(targetId)!.style || {}),
                ...styleMap,
              };
            }
          }
        }
      }
      continue;
    }

    // 5.b LinkStyle definition: linkStyle 0 stroke:#...,stroke-width:...
    if (token.type === 'LINK_STYLE') {
      advance(); // consume 'linkStyle'
      const parts: string[] = [];
      while (
        currentToken().type !== 'NEWLINE' &&
        currentToken().type !== 'EOF'
      ) {
        parts.push(advance().value);
      }

      const fullStr = parts.join(' ').trim();
      const tokensList = fullStr.split(/\s+/);
      const targetParts: string[] = [];
      const styleTokens: string[] = [];
      let foundStyle = false;

      for (const t of tokensList) {
        if (!foundStyle && !t.includes(':')) {
          targetParts.push(t);
        } else {
          foundStyle = true;
          styleTokens.push(t);
        }
      }

      const targetSpec = targetParts.join('').replace(/;$/, '');
      const stylesStr = styleTokens.join(' ');
      const styleMap = parseStyleDeclarations(stylesStr);

      pendingLinkStyles.push({ targetSpec, styleMap });
      continue;
    }

    // 6. Class definition: classDef name fill:#...
    if (token.type === 'CLASS_DEF') {
      advance(); // consume 'classDef'
      if (currentToken().type === 'IDENTIFIER') {
        const className = advance().value;
        const styleParts: string[] = [];

        while (
          currentToken().type !== 'NEWLINE' &&
          currentToken().type !== 'EOF'
        ) {
          styleParts.push(advance().value);
        }

        const fullStr = styleParts.join(' ');
        const styleMap = parseStyleDeclarations(fullStr);

        ast.classDefs.set(className, {
          type: 'classDef',
          name: className,
          styles: styleMap,
        });
      }
      continue;
    }

    // 6.b Class assignment: class Node1,Node2 className
    if (token.type === 'CLASS') {
      advance(); // consume 'class'
      const classTokens: Token[] = [];
      while (
        currentToken().type !== 'NEWLINE' &&
        currentToken().type !== 'EOF'
      ) {
        classTokens.push(advance());
      }

      const fullLine = classTokens
        .map((t) => t.value)
        .join(' ')
        .trim()
        .replace(/;$/, '');
      const words = fullLine.split(/\s+/).filter(Boolean);
      if (words.length >= 2) {
        const className = words[words.length - 1].trim();
        const targetsRaw = words.slice(0, words.length - 1).join(' ');
        const targetIds = targetsRaw
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean);

        for (const targetId of targetIds) {
          if (!ast.nodes.has(targetId)) {
            ensureNodeExists({ id: targetId });
          }
          const node = ast.nodes.get(targetId);
          if (node) {
            node.classes = Array.from(
              new Set([...(node.classes || []), className])
            );
          }
        }
      }
      continue;
    }

    // 7. Interaction / metadata statements the editor does not model
    // (click, accTitle, accDescr, title) — preserved verbatim so visual
    // edits never corrupt or drop hand-written code.
    if (token.type === 'IDENTIFIER' && tryConsumeRawStatement()) {
      continue;
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

  function tryConsumeRawStatement(): boolean {
    const tok = currentToken();
    if (tok.type !== 'IDENTIFIER') return false;
    const first = tok.value;
    const isClick = /^click$/i.test(first);
    const isMeta =
      /^(accTitle|accDescr|title)$/i.test(first) ||
      /^acc(Title|Descr)/i.test(first);
    if (!isClick && !isMeta) return false;

    const lineNo = tok.line;
    const srcTrim = (inputLines[lineNo - 1] ?? '').trim();
    // Multiline accDescr { ... } block: the lexer drops the bare `{`, so
    // detect it from the source line before the token-count guard below.
    const isAccDescrBlock =
      /^accDescr\s*\{/i.test(srcTrim) && !/\}\s*$/.test(srcTrim);

    // Peek at every token on this source line.
    const lineTokens: Token[] = [];
    let peek = cursor;
    while (
      peek < tokens.length &&
      tokens[peek].type !== 'NEWLINE' &&
      tokens[peek].type !== 'EOF' &&
      tokens[peek].line === lineNo
    ) {
      lineTokens.push(tokens[peek]);
      peek++;
    }

    // A genuine node/edge statement always carries an arrow, an edge label,
    // or a node shape with a label (a node literally named "click" can still
    // sprout edges: `click --> X`). Interaction statements never do — the
    // only shape-like text they contain is the empty `()` of a `call fn()`.
    const hasStructure = lineTokens.some(
      (t) =>
        t.type === 'ARROW' ||
        t.type === 'ARROW_LABEL' ||
        (t.type === 'NODE_SHAPE' && (t.labelText ?? '').trim() !== '')
    );
    if (hasStructure) return false;
    // `click <target> <action>` needs at least 3 words; a lone `click` or
    // `click B` stays a normal node definition.
    if (!isAccDescrBlock && isClick && lineTokens.length < 3) return false;
    if (!isAccDescrBlock && !isClick && lineTokens.length < 2) return false;

    let rawText = srcTrim;
    // Consume the rest of this source line.
    while (
      currentToken().type !== 'NEWLINE' &&
      currentToken().type !== 'EOF'
    ) {
      advance();
    }

    // Multiline accDescr { ... } block: consume verbatim until the closing }.
    // Driven off source lines (not tokens) because lines like `}` produce
    // no tokens in the flowchart lexer.
    if (isAccDescrBlock) {
      const block = [rawText];
      let idx = lineNo; // 0-based index of the source line after the opener
      while (idx < inputLines.length) {
        const src = (inputLines[idx] ?? '').trim();
        idx++;
        block.push(src === '' ? '' : '    ' + src);
        if (/^\}/.test(src)) break;
      }
      // Advance the cursor past every token on the consumed source lines.
      // Consumed 1-based lines are lineNo..idx, so drop tokens with line <= idx.
      while (
        cursor < tokens.length &&
        currentToken().type !== 'EOF' &&
        currentToken().line <= idx
      ) {
        advance();
      }
      rawText = block.join('\n');
    }

    ast.rawLines.push({ type: 'raw', text: rawText });
    return true;
  }

  function parseNodeOrEdgeStatement() {
    let leftNode = parseSingleNode();
    if (!leftNode) return;

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

      const rightNode = parseSingleNode();
      if (!rightNode) break;

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

  function parseSingleNode(): {
    id: string;
    label?: string;
    shape?: MermaidShapeType;
    classes?: string[];
  } | null {
    if (currentToken().type !== 'IDENTIFIER') return null;

    const idToken = advance();
    const id = idToken.value;
    let label: string | undefined;
    let shape: MermaidShapeType | undefined;
    const classes: string[] = [];

    if (currentToken().type === 'NODE_SHAPE') {
      const shapeToken = advance();
      label = shapeToken.labelText;
      shape = shapeToken.shapeType as MermaidShapeType;
    }

    // Parse one or more :::className
    while (currentToken().type === 'CLASS_ASSIGN') {
      advance(); // consume ':::'
      if (currentToken().type === 'IDENTIFIER') {
        classes.push(advance().value);
      }
    }

    return {
      id,
      label,
      shape,
      classes: classes.length > 0 ? classes : undefined,
    };
  }

  function ensureNodeExists(nodeInfo: {
    id: string;
    label?: string;
    shape?: MermaidShapeType;
    classes?: string[];
  }) {
    const currentSubId = subgraphStack[subgraphStack.length - 1];

    if (!ast.nodes.has(nodeInfo.id)) {
      const newNode: MermaidNodeDef = {
        type: 'node',
        id: nodeInfo.id,
        label: nodeInfo.label || nodeInfo.id,
        shape: nodeInfo.shape || 'rectangle',
        subgraphId: currentSubId,
        classes: nodeInfo.classes ? [...nodeInfo.classes] : undefined,
      };
      ast.nodes.set(nodeInfo.id, newNode);

      if (currentSubId && ast.subgraphs.has(currentSubId)) {
        const sub = ast.subgraphs.get(currentSubId)!;
        if (!sub.nodeIds.includes(nodeInfo.id)) {
          sub.nodeIds.push(nodeInfo.id);
        }
      }
    } else {
      // Update existing node with label/shape/classes if supplied
      const existing = ast.nodes.get(nodeInfo.id)!;
      if (nodeInfo.label) existing.label = nodeInfo.label;
      if (nodeInfo.shape) existing.shape = nodeInfo.shape;
      if (nodeInfo.classes && nodeInfo.classes.length > 0) {
        existing.classes = Array.from(
          new Set([...(existing.classes || []), ...nodeInfo.classes])
        );
      }
      if (currentSubId && !existing.subgraphId) {
        existing.subgraphId = currentSubId;
        const sub = ast.subgraphs.get(currentSubId);
        if (sub && !sub.nodeIds.includes(nodeInfo.id)) {
          sub.nodeIds.push(nodeInfo.id);
        }
      }
    }
  }
}
