import test from 'node:test';
import assert from 'node:assert';
import { findTargetMermaidBlock } from '../src/utils/markdownBlock';

test('Multi-Diagram: 2 flowcharts in one page accurately selects second diagram', () => {
  const noteContent = `# Meeting Notes
Some intro text here.

\`\`\`mermaid
flowchart TD
    A["First Diagram Start"] --> B["First Diagram Process"]
\`\`\`

Middle explanatory text here.

\`\`\`mermaid
flowchart LR
    C["Second Diagram Login"] --> D["Second Diagram Dashboard"]
\`\`\`

Footer text.`;

  // 1. By line hint (e.g. CodeMirror 6 posAtDOM around line 13)
  const resultByLine = findTargetMermaidBlock({
    content: noteContent,
    hintLine: 13,
  });
  assert.ok(resultByLine);
  assert.match(resultByLine.rawCode, /Second Diagram Login/);
  assert.doesNotMatch(resultByLine.rawCode, /First Diagram Start/);

  // 2. By sequential DOM index (e.g. 2nd button in view, index 1)
  const resultByDomIndex = findTargetMermaidBlock({
    content: noteContent,
    domIndex: 1,
  });
  assert.ok(resultByDomIndex);
  assert.match(resultByDomIndex.rawCode, /Second Diagram Login/);

  // 3. By sectionLineStart (e.g. Reading View context.getSectionInfo)
  const resultBySection = findTargetMermaidBlock({
    content: noteContent,
    sectionLineStart: 11,
  });
  assert.ok(resultBySection);
  assert.match(resultBySection.rawCode, /Second Diagram Login/);

  // 4. By DOM text matching
  const resultByText = findTargetMermaidBlock({
    content: noteContent,
    domText: 'Second Diagram Dashboard',
  });
  assert.ok(resultByText);
  assert.match(resultByText.rawCode, /Second Diagram Login/);
});

test('Multi-Diagram: Flowchart and State Diagram on the same page', () => {
  const noteContent = `# Architecture & Lifecycle
Here is the system flow:

\`\`\`mermaid
flowchart TD
    Client["Web Client"] --> Server["API Gateway"]
\`\`\`

And here is the session state machine:

\`\`\`mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> Authenticated : onLogin
    Authenticated --> [*] : onLogout
\`\`\`
`;

  // Clicking on the state diagram (2nd diagram)
  const stateBlock = findTargetMermaidBlock({
    content: noteContent,
    domIndex: 1,
    domText: 'Idle Authenticated onLogin onLogout',
  });
  assert.ok(stateBlock);
  assert.match(stateBlock.rawCode, /stateDiagram-v2/);
  assert.match(stateBlock.rawCode, /Authenticated/);
  assert.doesNotMatch(stateBlock.rawCode, /API Gateway/);

  // Clicking on the flowchart (1st diagram)
  const flowBlock = findTargetMermaidBlock({
    content: noteContent,
    domIndex: 0,
    hintLine: 4,
    domText: 'Web Client API Gateway',
  });
  assert.ok(flowBlock);
  assert.match(flowBlock.rawCode, /flowchart TD/);
  assert.match(flowBlock.rawCode, /API Gateway/);
});
