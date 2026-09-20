/**
 * Parser for interaction and metadata raw statements (click, accTitle, accDescr, title).
 * Preserved verbatim so visual edits never corrupt or drop hand-written code.
 */

import { Token } from './lexer';
import { MermaidFlowchartAST } from './types';

export function tryConsumeRawStatement(
  tokens: readonly Token[],
  cursor: number,
  inputLines: readonly string[],
  ast: MermaidFlowchartAST
): number | null {
  const tok = tokens[cursor];
  if (!tok || tok.type !== 'IDENTIFIER') return null;

  const first = tok.value;
  const isClick = /^click$/i.test(first);
  const isMeta =
    /^(accTitle|accDescr|title)$/i.test(first) ||
    /^acc(Title|Descr)/i.test(first);
  if (!isClick && !isMeta) return null;

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
  if (hasStructure) return null;

  // `click <target> <action>` needs at least 3 words; a lone `click` or
  // `click B` stays a normal node definition.
  if (!isAccDescrBlock && isClick && lineTokens.length < 3) return null;
  if (!isAccDescrBlock && !isClick && lineTokens.length < 2) return null;

  let rawText = srcTrim;
  let cur = cursor;
  // Consume the rest of this source line.
  while (
    cur < tokens.length &&
    tokens[cur].type !== 'NEWLINE' &&
    tokens[cur].type !== 'EOF'
  ) {
    cur++;
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
      cur < tokens.length &&
      tokens[cur].type !== 'EOF' &&
      tokens[cur].line <= idx
    ) {
      cur++;
    }
    rawText = block.join('\n');
  }

  ast.rawLines.push({ type: 'raw', text: rawText });
  return cur;
}
