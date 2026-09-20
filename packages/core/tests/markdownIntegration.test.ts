import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findMermaidBlockBounds, replaceMermaidBlock } from '../src/utils/markdownBlock';
import { parseMermaidFlowchart } from '../src/diagrams/flowchart/parser';
import { serializeMermaidFlowchart } from '../src/diagrams/flowchart/serializer';
import { addChildNode, deleteNode } from '../src/diagrams/flowchart/mutations';

test('Markdown Integration: Rapid successive deletions shrinking diagram across 5 saves', () => {
  let doc = `
# System Architecture

Here is the initial design:

\`\`\`mermaid
flowchart TD
    N1["Step 1"] --> N2["Step 2"]
    N2 --> N3["Step 3"]
    N3 --> N4["Step 4"]
    N4 --> N5["Step 5"]
    N5 --> N6["Step 6"]
\`\`\`

## Notes below diagram
Important notes that must never be altered or corrupted.
`.trim();

  let hintStartLine = 4;
  let code = `
flowchart TD
    N1["Step 1"] --> N2["Step 2"]
    N2 --> N3["Step 3"]
    N3 --> N4["Step 4"]
    N4 --> N5["Step 5"]
    N5 --> N6["Step 6"]
`.trim();

  // Delete nodes one by one
  for (let i = 6; i >= 2; i--) {
    const ast = parseMermaidFlowchart(code);
    deleteNode(ast, `N${i}`);
    const nextCode = serializeMermaidFlowchart(ast).trim();

    const result = replaceMermaidBlock(doc, nextCode, hintStartLine, code);
    doc = result.updatedText;
    hintStartLine = result.newStartLine;
    code = nextCode;

    // Verify invariant after every single deletion
    assert.ok(doc.includes('```mermaid'), `Must retain opening fence on iteration ${i}`);
    assert.ok(doc.includes('```\n\n## Notes below diagram'), `Must retain closing fence and notes on iteration ${i}`);
    assert.ok(doc.includes('# System Architecture'), `Must retain heading on iteration ${i}`);

    // Verify closing fence count in document
    const closingFenceCount = (doc.match(/^```$/gm) || []).length;
    assert.equal(closingFenceCount, 1, `Must have exactly one closing fence on iteration ${i}`);
  }
});

test('Markdown Integration: Rapid successive additions expanding diagram across 5 saves', () => {
  let doc = `
# Project Plan

\`\`\`mermaid
flowchart TD
    Root["Start"]
\`\`\`

End of section.
`.trim();

  let hintStartLine = 2;
  let code = 'flowchart TD\n    Root["Start"]';

  for (let i = 1; i <= 5; i++) {
    const ast = parseMermaidFlowchart(code);
    addChildNode(ast, i === 1 ? 'Root' : `step_${i}`, `Task ${i}`);
    const nextCode = serializeMermaidFlowchart(ast).trim();

    const result = replaceMermaidBlock(doc, nextCode, hintStartLine, code);
    doc = result.updatedText;
    hintStartLine = result.newStartLine;
    code = nextCode;

    // Verify invariants
    assert.ok(doc.includes('```mermaid'));
    assert.ok(doc.includes('```\n\nEnd of section.'));
    assert.ok(doc.includes(`Task ${i}`));
  }
});

test('Markdown Integration: Mermaid block at line 0 (start of document)', () => {
  const doc = `\`\`\`mermaid
flowchart LR
    A --> B
\`\`\`
Text right after block.`;

  const newCode = `flowchart LR
    A --> B
    B --> C`;

  const result = replaceMermaidBlock(doc, newCode, 0);
  assert.equal(result.newStartLine, 0);
  assert.ok(result.updatedText.startsWith('```mermaid\nflowchart LR\n'));
  assert.ok(result.updatedText.includes('```\nText right after block.'));
});

test('Markdown Integration: Mermaid block at EOF without trailing newline', () => {
  const doc = `# Header\n\n\`\`\`mermaid\nflowchart TD\n    A --> B\n\`\`\``;

  const newCode = `flowchart TD\n    A --> B\n    B --> C\n    C --> D`;

  const result = replaceMermaidBlock(doc, newCode, 2);
  assert.equal(result.newStartLine, 2);
  assert.ok(result.updatedText.endsWith('```'));
  assert.ok(result.updatedText.includes('C --> D'));
  assert.ok(result.updatedText.startsWith('# Header\n\n```mermaid\n'));
});

test('Markdown Integration: Multi-block document with YAML, Callouts, Math, Code blocks, and 3 Diagrams', () => {
  const doc = `---
title: System Architecture Note
tags:
  - architecture
  - backend
date: 2026-09-07
---

# Architecture Overview

> [!NOTE] System Invariant
> High availability is enforced across all services.

## Pipeline 1: Ingestion
\`\`\`mermaid
flowchart TD
    Ingest[Data Ingestion] --> Validate[Validator]
\`\`\`

Some math formulation:
$$
E = mc^2
$$

## Pipeline 2: Processing (Target Diagram)
\`\`\`mermaid
flowchart LR
    Worker[Worker Node] --> Queue[Redis Queue]
\`\`\`

Code snippet in another language:
\`\`\`typescript
export function runWorker() {
  console.log("Worker active");
}
\`\`\`

## Pipeline 3: Analytics
\`\`\`mermaid
flowchart TD
    Analytics[Analytics Engine] --> Dashboard[Grafana]
\`\`\`

Final conclusion.
`;

  // We want to edit Pipeline 2 (the second diagram)
  const lines = doc.split('\n');
  const pipeline2StartLine = lines.findIndex((l) => l.includes('Worker Node')) - 1; // line of ```mermaid for Pipeline 2
  assert.ok(pipeline2StartLine > 0);

  const initialCode2 = `flowchart LR\n    Worker[Worker Node] --> Queue[Redis Queue]`;
  const ast2 = parseMermaidFlowchart(initialCode2);
  addChildNode(ast2, 'Queue', 'Persistent Store');
  const updatedCode2 = serializeMermaidFlowchart(ast2).trim();

  const result = replaceMermaidBlock(
    doc,
    updatedCode2,
    pipeline2StartLine,
    initialCode2
  );

  // Assertions:
  // 1. YAML frontmatter untouched
  assert.ok(result.updatedText.startsWith('---\ntitle: System Architecture Note'));
  // 2. Callout untouched
  assert.ok(result.updatedText.includes('> [!NOTE] System Invariant'));
  // 3. Pipeline 1 untouched
  assert.ok(result.updatedText.includes('Ingest[Data Ingestion] --> Validate[Validator]'));
  // 4. Math block untouched
  assert.ok(result.updatedText.includes('$$\nE = mc^2\n$$'));
  // 5. TypeScript code block untouched
  assert.ok(result.updatedText.includes('```typescript\nexport function runWorker()'));
  // 6. Pipeline 3 untouched
  assert.ok(result.updatedText.includes('Analytics[Analytics Engine] --> Dashboard[Grafana]'));
  // 7. Pipeline 2 updated with new step
  assert.ok(result.updatedText.includes('Persistent Store'));
  // 8. Total mermaid blocks remains exactly 3
  const mermaidBlockMatches = result.updatedText.match(/```mermaid/g) || [];
  assert.equal(mermaidBlockMatches.length, 3);
});

test('Markdown Integration: Hint drift outward search locates shifted block', () => {
  const doc = `
Paragraph 1
Paragraph 2
Paragraph 3
Paragraph 4
Paragraph 5

\`\`\`mermaid
flowchart TD
    Drift[Drift Test]
\`\`\`

Footer
`.trim();

  // Actual block starts at line 6
  // But user passed hint line 1 (drifted by 5 lines)
  const targetCode = 'flowchart TD\n    Drift[Drift Test]\n    Drift --> Resolved[Resolved]';

  const result = replaceMermaidBlock(doc, targetCode, 1);
  assert.equal(result.newStartLine, 6);
  assert.ok(result.updatedText.includes('Drift --> Resolved[Resolved]'));
  assert.ok(result.updatedText.includes('Footer'));
});

test('Markdown Integration: Auto-healing note when closing fence was deleted', () => {
  const corruptedDoc = `
# Broken Note

\`\`\`mermaid
flowchart TD
    Broken[No Closing Delimiter]

## Next Section Heading
This heading was stranded without a closing code fence.
`.trim();

  const fixedCode = `flowchart TD\n    Broken[Healed Diagram]\n    Broken --> OK[OK]`;

  const result = replaceMermaidBlock(corruptedDoc, fixedCode, 2);

  // Must have synthesized the closing ``` fence before the next section
  assert.ok(result.updatedText.includes('```\n\n## Next Section Heading'));
  assert.ok(result.updatedText.includes('Broken[Healed Diagram]'));
  assert.ok(result.updatedText.includes('Broken --> OK[OK]'));
});
