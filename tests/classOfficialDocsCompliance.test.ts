import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { ClassDiagramDriver } from '../src/diagrams/class/classDriver';
import { parseMermaidClassDiagram } from '../src/diagrams/class/parser';
import { serializeMermaidClassDiagram } from '../src/diagrams/class/serializer';

// Setup DOM mock for mermaid.render
const dom = new JSDOM('<!DOCTYPE html><html><body><div id="c"></div></body></html>');
(global as any).window = dom.window;
(global as any).document = dom.window.document;
(global as any).SVGElement = dom.window.SVGElement;
(global as any).Element = dom.window.Element;
dom.window.SVGElement.prototype.getBBox = () => ({ x: 0, y: 0, width: 100, height: 100 });
(global as any).CSSStyleSheet = class CSSStyleSheet {
  cssRules = [];
  replaceSync() {}
  insertRule() {}
};

async function verifyMermaidRenders(renderId: string, code: string): Promise<void> {
  const mermaid = (await import('mermaid')).default;
  mermaid.initialize({ startOnLoad: false });
  const { svg } = await mermaid.render(renderId, code);
  assert.ok(svg && svg.length > 0, 'Mermaid must render valid SVG');
}

test('Class Official Docs: Header variants (classDiagram and classDiagram-v2) and direction', async () => {
  const code1 = `classDiagram
    direction LR
    class Animal
    class Duck
    Animal <|-- Duck
`;
  assert.ok(ClassDiagramDriver.canHandle(code1));
  const ast1 = parseMermaidClassDiagram(code1);
  assert.strictEqual(ast1.diagramType, 'classDiagram');
  assert.strictEqual(ast1.direction, 'LR');
  assert.strictEqual(ast1.classes.size, 2);
  assert.strictEqual(ast1.relationships.length, 1);

  const serialized1 = serializeMermaidClassDiagram(ast1);
  assert.ok(serialized1.includes('classDiagram'));
  assert.ok(serialized1.includes('direction LR'));
  await verifyMermaidRenders('test_hdr_1', serialized1);

  const code2 = `classDiagram-v2
    direction TB
    class Shape
`;
  assert.ok(ClassDiagramDriver.canHandle(code2));
  const ast2 = parseMermaidClassDiagram(code2);
  assert.strictEqual(ast2.diagramType, 'classDiagram-v2');
  assert.strictEqual(ast2.direction, 'TB');
  await verifyMermaidRenders('test_hdr_2', serializeMermaidClassDiagram(ast2));
});

test('Class Official Docs: Class members via block syntax and colon syntax', async () => {
  const blockCode = `classDiagram
    class BankAccount {
        +String owner
        +BigDecimal balance
        +deposit(amount) bool
        +withdrawal(amount) int
    }
`;
  const ast = parseMermaidClassDiagram(blockCode);
  const account = ast.classes.get('BankAccount');
  assert.ok(account);
  assert.strictEqual(account.members.length, 4);
  assert.strictEqual(account.members[0].visibility, '+');
  assert.strictEqual(account.members[0].text, 'String owner');
  assert.strictEqual(account.members[2].text, 'deposit(amount) bool');

  const serialized = serializeMermaidClassDiagram(ast);
  assert.ok(serialized.includes('+String owner'));
  assert.ok(serialized.includes('+deposit(amount) bool'));
  await verifyMermaidRenders('test_members_block', serialized);

  // Colon syntax
  const colonCode = `classDiagram
    class Animal
    Animal : +String name
    Animal : +int age
    Animal : +move() void
`;
  const colonAst = parseMermaidClassDiagram(colonCode);
  const animal = colonAst.classes.get('Animal');
  assert.ok(animal);
  assert.strictEqual(animal.members.length, 3);
  await verifyMermaidRenders('test_members_colon', serializeMermaidClassDiagram(colonAst));
});

test('Class Official Docs: Visibility modifiers and member classifiers (* abstract, $ static)', async () => {
  const code = `classDiagram
    class DemoClass {
        +publicField
        -privateField
        #protectedField
        ~packageField
        +abstractMethod()*
        +staticMethod()$
    }
`;
  const ast = parseMermaidClassDiagram(code);
  const demo = ast.classes.get('DemoClass');
  assert.ok(demo);
  assert.strictEqual(demo.members[0].visibility, '+');
  assert.strictEqual(demo.members[1].visibility, '-');
  assert.strictEqual(demo.members[2].visibility, '#');
  assert.strictEqual(demo.members[3].visibility, '~');
  assert.strictEqual(demo.members[4].classifier, '*');
  assert.strictEqual(demo.members[5].classifier, '$');

  const serialized = serializeMermaidClassDiagram(ast);
  await verifyMermaidRenders('test_vis_class', serialized);
});

test('Class Official Docs: Stereotypes and annotations (<<interface>>, <<abstract>>, <<service>>, <<enum>>)', async () => {
  const code = `classDiagram
    class Shape {
        <<interface>>
        +noOfVertices
        +draw()
    }
    class Color {
        <<enumeration>>
        RED
        BLUE
        GREEN
    }
    class Controller {
        <<service>>
        +handleRequest()
    }
`;
  const ast = parseMermaidClassDiagram(code);
  assert.strictEqual(ast.classes.get('Shape')?.kind, 'interface');
  assert.strictEqual(ast.classes.get('Color')?.kind, 'enum');
  assert.strictEqual(ast.classes.get('Controller')?.kind, 'service');

  const proj = ClassDiagramDriver.project(ast);
  assert.strictEqual(proj.nodes.get('Shape')?.kind, 'interface');
  assert.strictEqual(proj.nodes.get('Color')?.kind, 'enum');
  assert.strictEqual(proj.nodes.get('Controller')?.kind, 'service');

  const serialized = serializeMermaidClassDiagram(ast);
  await verifyMermaidRenders('test_stereotypes', serialized);
});

test('Class Official Docs: All relationship varieties, cardinalities, and labels', async () => {
  const code = `classDiagram
    Class01 <|-- Class02
    Class03 *-- Class04
    Class05 o-- Class06
    Class07 .. Class08
    Class09 --> Class10
    Class11 ..> Class12
    Class13 ..|> Class14
    Class15 -- Class16
    Class17 <|--|> Class18
    Customer "1" --> "*" Ticket : places
    Student "1" ..> "1..*" Course : attends
`;
  const ast = parseMermaidClassDiagram(code);
  assert.strictEqual(ast.relationships.length, 11);

  // Check customer relationship with cardinalities
  const custRel = ast.relationships.find((r) => r.from === 'Customer' && r.to === 'Ticket');
  assert.ok(custRel);
  assert.strictEqual(custRel.leftCardinality, '1');
  assert.strictEqual(custRel.rightCardinality, '*');
  assert.strictEqual(custRel.label, 'places');
  assert.strictEqual(custRel.rawRelation, '-->');

  const serialized = serializeMermaidClassDiagram(ast);
  assert.ok(serialized.includes('Customer "1" --> "*" Ticket : places'));
  await verifyMermaidRenders('test_rel_types', serialized);
});

test('Class Official Docs: Namespaces with grouped classes and relationships', async () => {
  const code = `classDiagram
    namespace BaseShapes {
        class Shape {
            +draw()
        }
        class Triangle
    }
    namespace Specialized {
        class RightTriangle
    }
    Shape <|-- Triangle
    Triangle <|-- RightTriangle
`;
  const ast = parseMermaidClassDiagram(code);
  assert.strictEqual(ast.namespaces.size, 2);
  assert.ok(ast.namespaces.get('BaseShapes')?.classIds.includes('Shape'));
  assert.ok(ast.namespaces.get('BaseShapes')?.classIds.includes('Triangle'));
  assert.ok(ast.namespaces.get('Specialized')?.classIds.includes('RightTriangle'));

  const proj = ClassDiagramDriver.project(ast);
  assert.strictEqual(proj.subgraphs.size, 2);
  assert.strictEqual(proj.nodes.get('Shape')?.subgraphId, 'BaseShapes');
  assert.strictEqual(proj.nodes.get('RightTriangle')?.subgraphId, 'Specialized');

  const serialized = serializeMermaidClassDiagram(ast);
  assert.ok(serialized.includes('namespace BaseShapes {'));
  assert.ok(serialized.includes('namespace Specialized {'));
  await verifyMermaidRenders('test_namespaces', serialized);
});

test('Class Official Docs: Bracket labels and custom display names', async () => {
  const code = `classDiagram
    class Square["Square Shape"] {
        +int width
        +int height
    }
    class Circle["Round Circle"]
    Square <|-- Circle
`;
  const ast = parseMermaidClassDiagram(code);
  assert.strictEqual(ast.classes.get('Square')?.label, 'Square Shape');
  assert.strictEqual(ast.classes.get('Circle')?.label, 'Round Circle');

  const proj = ClassDiagramDriver.project(ast);
  assert.strictEqual(proj.nodes.get('Square')?.label, 'Square Shape');
  assert.strictEqual(proj.nodes.get('Circle')?.label, 'Round Circle');

  const serialized = serializeMermaidClassDiagram(ast);
  assert.ok(serialized.includes('class Square["Square Shape"]'));
  assert.ok(serialized.includes('class Circle["Round Circle"]'));
  await verifyMermaidRenders('test_bracket_labels', serialized);
});

test('Class Official Docs: Preservation of comments, notes, styles, clicks, and links', async () => {
  const code = `---
config:
  theme: dark
---
classDiagram
    %% This is a preserved comment
    accTitle: Class Overview
    accDescr: Demonstrates class architecture
    class Duck {
        +quack()
    }
    note "A general diagram note"
    note for Duck "This is a note for Duck"
    classDef highlight fill:#f9f,stroke:#333;
    style Duck fill:#e1f5fe,stroke:#0288d1;
    link Duck "https://example.com" "Duck Link"
`;
  const ast = parseMermaidClassDiagram(code);
  assert.ok(ast.frontmatter);
  assert.ok(ast.rawLines.some((r) => r.raw.includes('preserved comment')));
  assert.ok(ast.rawLines.some((r) => r.raw.includes('accTitle: Class Overview')));
  assert.ok(ast.rawLines.some((r) => r.raw.includes('note for Duck')));
  assert.ok(ast.rawLines.some((r) => r.raw.includes('link Duck')));

  // Node link extraction works
  const url = ClassDiagramDriver.getNodeLink?.(ast, 'Duck');
  assert.strictEqual(url, 'https://example.com');

  // Style applied to class
  assert.strictEqual(ast.classes.get('Duck')?.style?.fill, '#e1f5fe');

  const serialized = serializeMermaidClassDiagram(ast);
  assert.ok(serialized.includes('theme: dark'));
  assert.ok(serialized.includes('%% This is a preserved comment'));
  assert.ok(serialized.includes('accTitle: Class Overview'));
  assert.ok(serialized.includes('note "A general diagram note"'));
  assert.ok(serialized.includes('note for Duck'));
  assert.ok(serialized.includes('link Duck'));
  assert.ok(serialized.includes('style Duck fill:#e1f5fe,stroke:#0288d1'));

  await verifyMermaidRenders('test_preservation', serialized);
});
