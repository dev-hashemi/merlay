import test from 'node:test';
import assert from 'node:assert';
import {
  detectDiagramType,
  getDriver,
  getDriverForCode,
  getAllDrivers,
  isDiagramSupported,
  DIAGRAM_TEMPLATES,
} from '../src/diagrams/registry';

test('Diagram Registry: detectDiagramType', () => {
  // Flowchart
  assert.strictEqual(detectDiagramType('flowchart TD\n  A --> B'), 'flowchart');
  assert.strictEqual(detectDiagramType('graph LR\n  A --> B'), 'flowchart');
  assert.strictEqual(detectDiagramType('%% comment\nflowchart LR\n A --> B'), 'flowchart');

  // State Diagram
  assert.strictEqual(detectDiagramType('stateDiagram-v2\n  [*] --> S1'), 'stateDiagram');
  assert.strictEqual(detectDiagramType('stateDiagram\n  [*] --> S1'), 'stateDiagram');
  assert.strictEqual(detectDiagramType('%% comment\nstateDiagram-v2\n [*] --> S1'), 'stateDiagram');

  // Other types
  assert.strictEqual(detectDiagramType('mindmap\n  root((Root))'), 'mindmap');
  assert.strictEqual(detectDiagramType('sequenceDiagram\n  Alice->>Bob: Hello'), 'sequenceDiagram');
  assert.strictEqual(detectDiagramType('classDiagram\n  class Animal'), 'classDiagram');
  assert.strictEqual(detectDiagramType('erDiagram\n  CUSTOMER ||--o{ ORDER : places'), 'erDiagram');

  // Unknown
  assert.strictEqual(detectDiagramType(''), 'unknown');
  assert.strictEqual(detectDiagramType('%% only comments\n%% here'), 'unknown');
});

test('Diagram Registry: getDriver and getDriverForCode', () => {
  const flowchartDriver = getDriver('flowchart');
  assert.ok(flowchartDriver);
  assert.strictEqual(flowchartDriver?.displayName, 'Flowchart');
  assert.strictEqual(flowchartDriver?.supportsDirection, true);

  const stateDriver = getDriver('stateDiagram');
  assert.ok(stateDriver);
  assert.strictEqual(stateDriver?.displayName, 'State Diagram');
  assert.strictEqual(stateDriver?.supportsDirection, true);

  const driverFromCode = getDriverForCode('stateDiagram-v2\n  [*] --> Idle');
  assert.strictEqual(driverFromCode?.type, 'stateDiagram');

  assert.strictEqual(getAllDrivers().length >= 2, true);
  assert.strictEqual(DIAGRAM_TEMPLATES.length >= 2, true);

  // Verify first template is Flowchart (default)
  assert.strictEqual(DIAGRAM_TEMPLATES[0].type, 'flowchart');
  assert.strictEqual(DIAGRAM_TEMPLATES[1].type, 'stateDiagram');
});

test('Diagram Registry: detectDiagramType for all 20+ mermaid diagrams', () => {
  // 3 Fully Supported editable diagrams
  assert.strictEqual(detectDiagramType('flowchart TD\n  A --> B'), 'flowchart');
  assert.strictEqual(detectDiagramType('graph LR\n  A --> B'), 'flowchart');
  assert.strictEqual(detectDiagramType('%% comment\nflowchart LR\n A --> B'), 'flowchart');
  assert.strictEqual(detectDiagramType('stateDiagram-v2\n  [*] --> S1'), 'stateDiagram');
  assert.strictEqual(detectDiagramType('stateDiagram\n  [*] --> S1'), 'stateDiagram');
  assert.strictEqual(detectDiagramType('sequenceDiagram\n  Alice->>Bob: Hello'), 'sequenceDiagram');

  // Additional 18+ diagrams (graceful view-only)
  assert.strictEqual(detectDiagramType('classDiagram\n  class Animal'), 'classDiagram');
  assert.strictEqual(detectDiagramType('classDiagram-v2\n  class Animal'), 'classDiagram');
  assert.strictEqual(detectDiagramType('erDiagram\n  CUSTOMER ||--o{ ORDER : places'), 'erDiagram');
  assert.strictEqual(detectDiagramType('journey\n  title My Journey'), 'journey');
  assert.strictEqual(detectDiagramType('gantt\n  title A Gantt Diagram'), 'gantt');
  assert.strictEqual(detectDiagramType('pie title Pets\n  "Dogs" : 386'), 'pie');
  assert.strictEqual(detectDiagramType('quadrantChart\n  title Reach and engagement'), 'quadrantChart');
  assert.strictEqual(detectDiagramType('requirementDiagram\n  requirement test_req {}'), 'requirementDiagram');
  assert.strictEqual(detectDiagramType('gitGraph\n  commit'), 'gitGraph');
  assert.strictEqual(detectDiagramType('C4Context\n  Person(user, "User")'), 'c4');
  assert.strictEqual(detectDiagramType('C4Container\n  Container(spa, "SPA")'), 'c4');
  assert.strictEqual(detectDiagramType('mindmap\n  root((Root))'), 'mindmap');
  assert.strictEqual(detectDiagramType('timeline\n  title History'), 'timeline');
  assert.strictEqual(detectDiagramType('sankey-beta\n  Bio-conversion,Losses,26.8'), 'sankey');
  assert.strictEqual(detectDiagramType('xychart-beta\n  title "Revenue"'), 'xychart');
  assert.strictEqual(detectDiagramType('block-beta\n  columns 3'), 'block');
  assert.strictEqual(detectDiagramType('packet-beta\n  0-15: "Source Port"'), 'packet');
  assert.strictEqual(detectDiagramType('kanban\n  Todo'), 'kanban');
  assert.strictEqual(detectDiagramType('architecture-beta\n  group api(cloud)[API]'), 'architecture');
  assert.strictEqual(detectDiagramType('zenuml\n  title ZenUML'), 'zenuml');
  assert.strictEqual(detectDiagramType('useCaseDiagram\n  actor User'), 'useCaseDiagram');
  assert.strictEqual(detectDiagramType('agentflow\n  state 1'), 'agentflow');

  // Frontmatter handling with any diagram
  assert.strictEqual(
    detectDiagramType('---\ntitle: Sample Pie\n---\npie\n  "A": 50\n  "B": 50'),
    'pie'
  );

  // Unknown
  assert.strictEqual(detectDiagramType(''), 'unknown');
  assert.strictEqual(detectDiagramType('%% only comments\n%% here'), 'unknown');
  assert.strictEqual(detectDiagramType('someRandomSyntax 123'), 'unknown');
});

test('Diagram Registry: isDiagramSupported', () => {
  // Registered editable drivers return true
  assert.strictEqual(isDiagramSupported('flowchart'), true);
  assert.strictEqual(isDiagramSupported('stateDiagram'), true);
  assert.strictEqual(isDiagramSupported('sequenceDiagram'), true);
  assert.strictEqual(isDiagramSupported('mindmap'), true);
  assert.strictEqual(isDiagramSupported('classDiagram'), true);

  // All other types return false (graceful view-only)
  assert.strictEqual(isDiagramSupported('pie'), false);
  assert.strictEqual(isDiagramSupported('gantt'), false);
  assert.strictEqual(isDiagramSupported('gitGraph'), false);
  assert.strictEqual(isDiagramSupported('unknown'), false);
});

test('Diagram Registry: Unsupported diagram driver fallback and view-only behavior', () => {
  // Driver from code for unsupported diagram
  const pieDriver = getDriverForCode('pie title Pets\n  "Dogs": 386\n  "Cats": 85');
  assert.ok(pieDriver);
  assert.strictEqual(pieDriver.type, 'pie');
  assert.strictEqual(pieDriver.displayName, 'Pie Chart');
  assert.strictEqual(pieDriver.capabilities.editable, false);
  assert.strictEqual(pieDriver.capabilities.supportsDirection, false);
  assert.strictEqual(pieDriver.capabilities.supportsGroups, false);
  assert.strictEqual(pieDriver.capabilities.supportsNodeKinds, false);

  // Raw code round-trip without corruption
  const rawCode = 'pie title Pets\n  "Dogs": 386\n  "Cats": 85';
  const ast = pieDriver.parse(rawCode);
  assert.strictEqual(pieDriver.serialize(ast), rawCode);
  const cloned = pieDriver.clone(ast);
  assert.strictEqual(pieDriver.serialize(cloned), rawCode);

  // Projection is clean and empty
  const projection = pieDriver.project(ast);
  assert.strictEqual(projection.nodes.size, 0);
  assert.strictEqual(projection.edges.length, 0);
  assert.strictEqual(projection.subgraphs.size, 0);

  // Mutations are safe no-ops
  assert.strictEqual(pieDriver.mutations.addNode(ast, 'test'), '');
  assert.strictEqual(pieDriver.mutations.isNodeTextEditable(ast, 'any'), false);
  assert.strictEqual(pieDriver.mutations.reverseEdge(ast, 'e1'), null);

  // Fallback for unknown syntax
  const unknownDriver = getDriverForCode('completelyUnrecognizedDirective');
  assert.strictEqual(unknownDriver.type, 'unknown');
  assert.strictEqual(unknownDriver.displayName, 'Mermaid Diagram');
  assert.strictEqual(unknownDriver.capabilities.editable, false);
});

