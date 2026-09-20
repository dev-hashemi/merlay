/**
 * Parser for Mermaid State Diagrams (stateDiagram-v2 / stateDiagram)
 */

import { StateToken, tokenizeStateDiagram } from './lexer';
import { splitFrontmatter } from '../common/diagramHeader';
import {
  MermaidCompositeStateDef,
  MermaidStateAST,
  MermaidStateType,
  MermaidTransitionDef,
  StateDirection,
} from './types';
import {
  ensureStateInAst,
  parseAndApplyStyleStatement,
  reconcileCompositesAndStyles,
} from './parserHelpers';

export function parseMermaidStateDiagram(input: string): MermaidStateAST {
  const { frontmatter, body } = splitFrontmatter(input);
  const tokens = tokenizeStateDiagram(body);
  let cursor = 0;

  const ast: MermaidStateAST = {
    diagramType: 'stateDiagram-v2',
    frontmatter,
    states: new Map(),
    transitions: [],
    compositeStates: new Map(),
    styles: [],
    rawLines: [],
  };

  const compositeStack: string[] = [];
  let stmtOrder = 0;

  function currentToken(): StateToken {
    return tokens[cursor] || { type: 'EOF', value: '', line: -1, col: -1 };
  }

  function advance(): StateToken {
    const t = currentToken();
    cursor++;
    return t;
  }

  function skipNewlines() {
    while (currentToken().type === 'NEWLINE') {
      advance();
    }
  }

  // Parse Header
  skipNewlines();
  if (currentToken().type === 'DIRECTIVE') {
    const dirToken = advance();
    ast.diagramType = dirToken.value.toLowerCase() === 'statediagram'
      ? 'stateDiagram'
      : 'stateDiagram-v2';
  }

  while (cursor < tokens.length && currentToken().type !== 'EOF') {
    skipNewlines();
    if (currentToken().type === 'EOF') break;

    const token = currentToken();

    // 1. Comments and unsupported statements — preserved verbatim so visual edits never drop them
    if (token.type === 'COMMENT' || token.type === 'RAW_LINE') {
      const t = advance();
      ast.rawLines.push({
        text: t.value,
        compositeId: compositeStack[compositeStack.length - 1],
        order: stmtOrder++,
      });
      continue;
    }

    // 2. Direction statement: direction LR / direction TB
    if (token.type === 'DIRECTION_KEYWORD') {
      advance(); // consume 'direction'
      if (currentToken().type === 'DIRECTION') {
        const dirVal = advance().value as StateDirection;
        const currentComposite = compositeStack[compositeStack.length - 1];
        if (currentComposite && ast.compositeStates.has(currentComposite)) {
          ast.compositeStates.get(currentComposite)!.direction = dirVal;
        } else {
          ast.direction = dirVal;
        }
      }
      continue;
    }

    // 3. Composite State close: '}'
    if (token.type === 'CLOSE_BRACE') {
      advance();
      compositeStack.pop();
      continue;
    }

    // 4. State keyword declaration:
    // - state "Label" as StateId
    // - state StateId <<choice>> / <<fork>> / <<join>>
    // - state StateId { ... }
    if (token.type === 'STATE_KEYWORD') {
      advance(); // consume 'state'
      parseStateKeywordStatement();
      continue;
    }

    // 5. Transition or State with colon statement:
    // - StateA --> StateB [: label]
    // - [*] --> StateA
    // - StateA --> [*]
    // - StateA : Label description
    if (token.type === 'START_END' || token.type === 'IDENTIFIER' || token.type === 'STRING') {
      parseTransitionOrStateDescription();
      continue;
    }

    // 6. Style statement: style StateA fill:... or style StateA, StateB fill:...
    if (token.type === 'STYLE') {
      advance(); // consume 'style'
      const lineTokens: StateToken[] = [];
      while (currentToken().type !== 'NEWLINE' && currentToken().type !== 'EOF') {
        lineTokens.push(advance());
      }
      parseAndApplyStyleStatement(lineTokens, ast);
      continue;
    }

    // Advance unknown tokens to avoid infinite loops
    advance();
  }

  reconcileCompositesAndStyles(ast);
  return ast;

  function parseStateKeywordStatement() {
    let label = '';
    let stateId = '';

    // Check if label string first: state "My State" as S1
    if (currentToken().type === 'STRING') {
      label = advance().value;
      if (currentToken().type === 'AS_KEYWORD') {
        advance(); // consume 'as'
        if (currentToken().type === 'IDENTIFIER' || currentToken().type === 'STRING') {
          stateId = advance().value;
        }
      }
    } else if (currentToken().type === 'IDENTIFIER') {
      stateId = advance().value;
      if (currentToken().type === 'AS_KEYWORD') {
        advance(); // consume 'as'
        if (currentToken().type === 'IDENTIFIER' || currentToken().type === 'STRING') {
          label = stateId;
          stateId = advance().value;
        }
      }
    }

    if (!stateId) return;

    // Check for colon description: state S1 : This is my description
    if (currentToken().type === 'COLON') {
      advance(); // consume ':'
      if (currentToken().type === 'STRING' || currentToken().type === 'IDENTIFIER') {
        label = advance().value.trim();
      }
    }

    // Check for stereotype <<choice>>, <<fork>>, <<join>>
    let stateType: MermaidStateType = 'normal';
    if (currentToken().type === 'CHOICE') {
      stateType = 'choice';
      advance();
    } else if (currentToken().type === 'FORK') {
      stateType = 'fork';
      advance();
    } else if (currentToken().type === 'JOIN') {
      stateType = 'join';
      advance();
    }

    // Check for composite state opening brace '{'
    if (currentToken().type === 'OPEN_BRACE') {
      advance(); // consume '{'
      const compDef: MermaidCompositeStateDef = {
        type: 'composite',
        id: stateId,
        label: label || stateId,
        stateIds: [],
        compositeIds: [],
        order: stmtOrder++,
      };
      ast.compositeStates.set(stateId, compDef);

      const parentComp = compositeStack[compositeStack.length - 1];
      if (parentComp && ast.compositeStates.has(parentComp)) {
        ast.compositeStates.get(parentComp)!.compositeIds.push(stateId);
      }

      compositeStack.push(stateId);
      return;
    }

    // Otherwise standard state or stereotype state
    ensureStateExists(stateId, label, stateType);
  }

  function parseTransitionOrStateDescription() {
    const fromToken = advance();
    const fromId = fromToken.value;

    if (fromId === '[*]') {
      ensureStateExists('[*]', '[*]', 'start');
    }

    // Case A: Transition: from --> to [: label]
    if (currentToken().type === 'ARROW') {
      advance(); // consume '-->'

      let toId = '';
      if (
        currentToken().type === 'START_END' ||
        currentToken().type === 'IDENTIFIER' ||
        currentToken().type === 'STRING'
      ) {
        toId = advance().value;
      }
      if (!toId) return;

      if (toId === '[*]') {
        ensureStateExists('[*]', '[*]', 'end');
      } else {
        ensureStateExists(toId);
      }

      if (fromId !== '[*]') {
        ensureStateExists(fromId);
      }

      let transitionLabel: string | undefined;
      if (currentToken().type === 'COLON') {
        advance(); // consume ':'
        if (currentToken().type === 'STRING' || currentToken().type === 'IDENTIFIER') {
          transitionLabel = advance().value.trim();
        }
      }

      const transitionDef: MermaidTransitionDef = {
        type: 'transition',
        id: `t_${fromId}_${toId}_${ast.transitions.length + 1}`,
        from: fromId,
        to: toId,
        label: transitionLabel,
        order: stmtOrder++,
      };

      ast.transitions.push(transitionDef);
      return;
    }

    // Case B: State description: StateId : Description
    if (currentToken().type === 'COLON') {
      advance(); // consume ':'
      let desc = '';
      if (currentToken().type === 'STRING' || currentToken().type === 'IDENTIFIER') {
        desc = advance().value.trim();
      }
      ensureStateExists(fromId, desc);
      return;
    }

    // Case C: Standalone state reference
    ensureStateExists(fromId);
  }

  function ensureStateExists(
    id: string,
    label?: string,
    stateType: MermaidStateType = 'normal'
  ) {
    ensureStateInAst(ast, compositeStack, id, label, stateType, () => stmtOrder++);
  }
}
