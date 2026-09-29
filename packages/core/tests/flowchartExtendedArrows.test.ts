import { describe, it } from 'node:test';
import assert from 'node:assert';
import { parseMermaidFlowchart } from '../src/diagrams/flowchart/parser';
import { serializeMermaidFlowchart } from '../src/diagrams/flowchart/serializer';
import { updateEdgeType, updateEdgeLength } from '../src/diagrams/flowchart/mutations/edgeMutations';
import { FlowchartDriver } from '../src/diagrams/flowchart/flowchartDriver';

describe('Flowchart Extended Arrowheads & Spacing', () => {
  it('parses extended arrowheads: circle, cross, bidirectional variants, and invisible', () => {
    const code = `flowchart TD
    A --o B
    B o--o C
    C --x D
    D x--x E
    E ~~~ F
`;
    const ast = parseMermaidFlowchart(code);
    assert.strictEqual(ast.edges.length, 5);

    assert.strictEqual(ast.edges[0].arrowType, 'circle');
    assert.strictEqual(ast.edges[1].arrowType, 'circle_bidirectional');
    assert.strictEqual(ast.edges[2].arrowType, 'cross');
    assert.strictEqual(ast.edges[3].arrowType, 'cross_bidirectional');
    assert.strictEqual(ast.edges[4].arrowType, 'invisible');
  });

  it('parses multi-dash arrow lengths for rank spacing', () => {
    const code = `flowchart LR
    A ---> B
    B ----> C
    C ===> D
    D -..-> E
    E ~~~~ F
`;
    const ast = parseMermaidFlowchart(code);
    assert.strictEqual(ast.edges.length, 5);

    assert.strictEqual(ast.edges[0].arrowType, 'arrow');
    assert.strictEqual(ast.edges[0].length, 2);

    assert.strictEqual(ast.edges[1].arrowType, 'arrow');
    assert.strictEqual(ast.edges[1].length, 3);

    assert.strictEqual(ast.edges[2].arrowType, 'thick');
    assert.strictEqual(ast.edges[2].length, 2);

    assert.strictEqual(ast.edges[3].arrowType, 'dotted');
    assert.strictEqual(ast.edges[3].length, 2);

    assert.strictEqual(ast.edges[4].arrowType, 'invisible');
    assert.strictEqual(ast.edges[4].length, 2);
  });

  it('serializes extended arrowheads and lengths accurately', () => {
    const code = `flowchart TD
    A --o B
    B o--o C
    C x--x D
    D ~~~ E
    E ---> F
`;
    const ast = parseMermaidFlowchart(code);
    const serialized = serializeMermaidFlowchart(ast);

    assert.match(serialized, /A\s+--o\s+B/);
    assert.match(serialized, /B\s+o--o\s+C/);
    assert.match(serialized, /C\s+x--x\s+D/);
    assert.match(serialized, /D\s+~~~\s+E/);
    assert.match(serialized, /E\s+--->\s+F/);
  });

  it('mutates edge type and length via driver mutations', () => {
    const code = `flowchart TD
    A --> B
`;
    const ast = parseMermaidFlowchart(code);
    const edgeId = ast.edges[0].id;

    // Mutate to circle with length 2
    FlowchartDriver.mutations.updateEdgeType?.(ast, edgeId, 'circle', 2);
    assert.strictEqual(ast.edges[0].arrowType, 'circle');
    assert.strictEqual(ast.edges[0].length, 2);

    let serialized = serializeMermaidFlowchart(ast);
    assert.match(serialized, /A\s+---o\s+B/);

    // Mutate to invisible with length 1
    FlowchartDriver.mutations.updateEdgeType?.(ast, edgeId, 'invisible', 1);
    assert.strictEqual(ast.edges[0].arrowType, 'invisible');
    assert.strictEqual(ast.edges[0].length, undefined);

    serialized = serializeMermaidFlowchart(ast);
    assert.match(serialized, /A\s+~~~\s+B/);

    // Mutate to cross bidirectional with length 3
    updateEdgeType(ast, edgeId, 'cross_bidirectional', 3);
    assert.strictEqual(ast.edges[0].arrowType, 'cross_bidirectional');
    assert.strictEqual(ast.edges[0].length, 3);

    serialized = serializeMermaidFlowchart(ast);
    assert.match(serialized, /A\s+x----x\s+B/);
  });
});
