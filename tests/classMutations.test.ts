import test from 'node:test';
import assert from 'node:assert/strict';
import { ClassDiagramDriver } from '../src/diagrams/class/classDriver';
import { parseMermaidClassDiagram } from '../src/diagrams/class/parser';
import { serializeMermaidClassDiagram } from '../src/diagrams/class/serializer';

test('Class Mutations: addClass generates collision-free IDs and adds to AST', () => {
  const code = `classDiagram\n    class Animal\n`;
  const ast = parseMermaidClassDiagram(code);

  const id1 = ClassDiagramDriver.mutations.addNode(ast, 'Dog');
  assert.ok(ast.classes.has(id1));
  assert.strictEqual(ast.classes.get(id1)?.label, 'Dog');

  const id2 = ClassDiagramDriver.mutations.addNode(ast, 'Cat');
  assert.ok(ast.classes.has(id2));
  assert.notStrictEqual(id1, id2);

  const serialized = ClassDiagramDriver.serialize(ast);
  assert.ok(serialized.includes(id1));
  assert.ok(serialized.includes(id2));
});

test('Class Mutations: addChildNode (sprout) creates a subclass and inheritance relationship', () => {
  const code = `classDiagram\n    class Vehicle\n`;
  const ast = parseMermaidClassDiagram(code);

  const childId = ClassDiagramDriver.mutations.addChildNode(ast, 'Vehicle', 'Car');
  assert.ok(ast.classes.has(childId));
  assert.strictEqual(ast.classes.get(childId)?.label, 'Car');

  // Must create an inheritance relationship Vehicle <|-- Car
  const rel = ast.relationships.find((r) => r.from === 'Vehicle' && r.to === childId);
  assert.ok(rel);
  assert.strictEqual(rel.rawRelation, '<|--');
  assert.strictEqual(rel.leftEnd, '<|');

  const serialized = ClassDiagramDriver.serialize(ast);
  assert.ok(serialized.includes(`Vehicle <|-- ${childId}`));
});

test('Class Mutations: deleteNode cascades to incident relationships', () => {
  const code = `classDiagram
    Animal <|-- Duck
    Animal <|-- Dog
    Duck --> Pond
`;
  const ast = parseMermaidClassDiagram(code);
  assert.strictEqual(ast.classes.size, 4);
  assert.strictEqual(ast.relationships.length, 3);

  // Deleting Duck should delete Duck and both edges connected to it
  ClassDiagramDriver.mutations.deleteNode(ast, 'Duck');
  assert.strictEqual(ast.classes.has('Duck'), false);
  assert.strictEqual(ast.relationships.length, 1);
  assert.strictEqual(ast.relationships[0].from, 'Animal');
  assert.strictEqual(ast.relationships[0].to, 'Dog');

  // Reparse verification
  const reparsed = parseMermaidClassDiagram(ClassDiagramDriver.serialize(ast));
  assert.strictEqual(reparsed.classes.has('Duck'), false);
  assert.strictEqual(reparsed.relationships.length, 1);
});

test('Class Mutations: updateNodeLabel and updateNodeKind', () => {
  const code = `classDiagram\n    class Shape\n`;
  const ast = parseMermaidClassDiagram(code);

  ClassDiagramDriver.mutations.updateNodeLabel(ast, 'Shape', 'Geometric Shape');
  assert.strictEqual(ast.classes.get('Shape')?.label, 'Geometric Shape');

  ClassDiagramDriver.mutations.updateNodeKind(ast, 'Shape', 'interface');
  assert.strictEqual(ast.classes.get('Shape')?.kind, 'interface');

  const serialized = ClassDiagramDriver.serialize(ast);
  assert.ok(serialized.includes('Geometric Shape'));
  assert.ok(serialized.includes('<<interface>>'));
});

test('Class Mutations: connect and canConnect legality predicate', () => {
  const code = `classDiagram
    namespace Graphics {
        class Canvas
    }
    class Engine
`;
  const ast = parseMermaidClassDiagram(code);

  // Legal connection between two classes
  assert.strictEqual(ClassDiagramDriver.mutations.canConnect?.(ast, 'Engine', 'Canvas'), true);
  ClassDiagramDriver.mutations.connect(ast, 'Engine', 'Canvas');
  assert.strictEqual(ast.relationships.length, 1);
  assert.strictEqual(ast.relationships[0].from, 'Engine');
  assert.strictEqual(ast.relationships[0].to, 'Canvas');

  // Illegal connection with a namespace container
  assert.strictEqual(ClassDiagramDriver.mutations.canConnect?.(ast, 'Engine', 'Graphics'), false);
  assert.strictEqual(ClassDiagramDriver.mutations.canConnect?.(ast, 'Graphics', 'Engine'), false);
  // connect() must be a no-op when called with illegal arguments
  ClassDiagramDriver.mutations.connect(ast, 'Engine', 'Graphics');
  assert.strictEqual(ast.relationships.length, 1); // unmutated

  // Illegal connection with non-existent node
  assert.strictEqual(ClassDiagramDriver.mutations.canConnect?.(ast, 'Engine', 'NonExistent'), false);
});

test('Class Mutations: reverseEdge swaps endpoints and arrowheads', () => {
  const code = `classDiagram
    Parent <|-- Child : inherits
`;
  const ast = parseMermaidClassDiagram(code);
  const relId = ast.relationships[0].id;

  const reversedId = ClassDiagramDriver.mutations.reverseEdge(ast, relId);
  assert.ok(reversedId);

  const rel = ast.relationships[0];
  assert.strictEqual(rel.from, 'Child');
  assert.strictEqual(rel.to, 'Parent');
  assert.strictEqual(rel.rightEnd, '|>');
  assert.strictEqual(rel.label, 'inherits');

  const serialized = ClassDiagramDriver.serialize(ast);
  assert.ok(serialized.includes('Child --|> Parent : inherits'));
});

test('Class Mutations: insertNodeOnEdge splits relationship into two segments', () => {
  const code = `classDiagram
    Alpha --> Gamma : flow
`;
  const ast = parseMermaidClassDiagram(code);
  const edgeId = ast.relationships[0].id;

  const midId = ClassDiagramDriver.mutations.insertNodeOnEdge(ast, edgeId, 'Beta');
  assert.ok(midId);
  assert.ok(ast.classes.has(midId));
  assert.strictEqual(ast.relationships.length, 2);

  // First segment: Alpha --> Beta
  assert.strictEqual(ast.relationships[0].from, 'Alpha');
  assert.strictEqual(ast.relationships[0].to, midId);

  // Second segment: Beta --> Gamma : flow
  assert.strictEqual(ast.relationships[1].from, midId);
  assert.strictEqual(ast.relationships[1].to, 'Gamma');
  assert.strictEqual(ast.relationships[1].label, 'flow');
});

test('Class Mutations: duplicateNodes clones classes and internal relationships with remapped IDs', () => {
  const code = `classDiagram
    class ClassA
    class ClassB
    class External
    ClassA --> ClassB : link
    ClassA --> External
`;
  const ast = parseMermaidClassDiagram(code);

  const result = ClassDiagramDriver.mutations.duplicateNodes(ast, ['ClassA', 'ClassB']);
  assert.strictEqual(result.nodeIds.length, 2);
  assert.strictEqual(result.edgeIds.length, 1);

  const clonedA = result.nodeIds[0];
  const clonedB = result.nodeIds[1];
  assert.ok(ast.classes.has(clonedA));
  assert.ok(ast.classes.has(clonedB));

  // The internal edge between A and B was cloned with remapped endpoints
  const clonedRel = ast.relationships.find((r) => r.id === result.edgeIds[0]);
  assert.ok(clonedRel);
  assert.strictEqual(clonedRel.from, clonedA);
  assert.strictEqual(clonedRel.to, clonedB);

  // External edge was NOT cloned because External was not duplicated
  assert.strictEqual(
    ast.relationships.filter((r) => r.to === 'External').length,
    1
  );
});

test('Class Mutations: Namespace management and empty container safeguard', () => {
  const code = `classDiagram\n    class NodeA\n    class NodeB\n`;
  const ast = parseMermaidClassDiagram(code);

  // createGroup creates namespace with placeholder to prevent syntax crash
  const ns1 = ClassDiagramDriver.mutations.createGroup(ast, 'MyModule');
  assert.ok(ast.namespaces.has(ns1));
  assert.ok(ast.namespaces.get(ns1)!.classIds.length > 0);

  // Move NodeA into ns1
  ClassDiagramDriver.mutations.moveNodeToGroup(ast, 'NodeA', ns1);
  assert.ok(ast.namespaces.get(ns1)!.classIds.includes('NodeA'));
  assert.strictEqual(ast.classes.get('NodeA')?.namespaceId, ns1);

  // Moving the last node out of a group dissolves the empty group
  const ns2 = ClassDiagramDriver.mutations.createGroupWithMembers(ast, 'TempModule', ['NodeB']);
  assert.ok(ast.namespaces.has(ns2));
  assert.strictEqual(ast.classes.get('NodeB')?.namespaceId, ns2);

  // Move NodeB to null (top level) dissolves TempModule
  ClassDiagramDriver.mutations.moveNodeToGroup(ast, 'NodeB', null);
  assert.strictEqual(ast.classes.get('NodeB')?.namespaceId, undefined);
  assert.strictEqual(ast.namespaces.has(ns2), false); // dissolved!
});

test('Class Mutations: Node styling mutations', () => {
  const code = `classDiagram\n    class Animal\n`;
  const ast = parseMermaidClassDiagram(code);

  ClassDiagramDriver.mutations.updateNodeStyle(ast, 'Animal', {
    fill: '#ffcdd2',
    stroke: '#e53935',
  });

  const style = ClassDiagramDriver.mutations.getNodeStyle(ast, 'Animal');
  assert.deepEqual(style, { fill: '#ffcdd2', stroke: '#e53935' });

  const serialized = ClassDiagramDriver.serialize(ast);
  assert.ok(serialized.includes('style Animal fill:#ffcdd2,stroke:#e53935;'));

  ClassDiagramDriver.mutations.clearNodeStyle(ast, 'Animal');
  assert.strictEqual(ClassDiagramDriver.mutations.getNodeStyle(ast, 'Animal'), undefined);
});

test('Class Mutations: Member / row management (add, update, delete, get)', () => {
  const code = `classDiagram
    class BankAccount {
        +String owner
        +deposit(amount)
    }
`;
  const ast = parseMermaidClassDiagram(code);

  // Initial members
  const members = ClassDiagramDriver.mutations.getNodeMembers!(ast, 'BankAccount');
  assert.deepEqual(members, {
    attributes: ['+String owner'],
    methods: ['+deposit(amount)'],
  });

  const caps = ClassDiagramDriver.mutations.getNodeMemberCapabilities!(ast, 'BankAccount');
  assert.strictEqual(caps.supportsAttributes, true);
  assert.strictEqual(caps.supportsMethods, true);

  // Add new attribute
  ClassDiagramDriver.mutations.addNodeMember!(ast, 'BankAccount', 'attribute', '-int balance');
  const membersAfterAttr = ClassDiagramDriver.mutations.getNodeMembers!(ast, 'BankAccount');
  assert.strictEqual(membersAfterAttr.attributes.length, 2);
  assert.strictEqual(membersAfterAttr.attributes[1], '-int balance');

  // Add new method
  ClassDiagramDriver.mutations.addNodeMember!(ast, 'BankAccount', 'method', '+withdraw(amount)');
  const membersAfterMethod = ClassDiagramDriver.mutations.getNodeMembers!(ast, 'BankAccount');
  assert.strictEqual(membersAfterMethod.methods.length, 2);
  assert.strictEqual(membersAfterMethod.methods[1], '+withdraw(amount)');

  // Update member
  ClassDiagramDriver.mutations.updateNodeMember!(
    ast,
    'BankAccount',
    'attribute',
    0,
    '+String accountHolder'
  );
  assert.strictEqual(
    ClassDiagramDriver.mutations.getNodeMembers!(ast, 'BankAccount').attributes[0],
    '+String accountHolder'
  );

  // Delete member explicitly
  ClassDiagramDriver.mutations.deleteNodeMember!(ast, 'BankAccount', 'method', 0); // remove deposit(amount)
  const membersAfterDelete = ClassDiagramDriver.mutations.getNodeMembers!(ast, 'BankAccount');
  assert.strictEqual(membersAfterDelete.methods.length, 1);
  assert.strictEqual(membersAfterDelete.methods[0], '+withdraw(amount)');

  // Update with empty text should delete the member
  ClassDiagramDriver.mutations.updateNodeMember!(ast, 'BankAccount', 'attribute', 1, '   '); // remove -int balance
  const membersAfterEmptyUpdate = ClassDiagramDriver.mutations.getNodeMembers!(ast, 'BankAccount');
  assert.strictEqual(membersAfterEmptyUpdate.attributes.length, 1);
  assert.strictEqual(membersAfterEmptyUpdate.attributes[0], '+String accountHolder');

  // Roundtrip verification
  const serialized = ClassDiagramDriver.serialize(ast);
  assert.ok(serialized.includes('+String accountHolder'));
  assert.ok(serialized.includes('+withdraw(amount)'));
  assert.ok(!serialized.includes('deposit(amount)'));
  assert.ok(!serialized.includes('-int balance'));

  const reparsed = parseMermaidClassDiagram(serialized);
  const reparsedMembers = ClassDiagramDriver.mutations.getNodeMembers!(reparsed, 'BankAccount');
  assert.strictEqual(reparsedMembers.attributes.length, 1);
  assert.strictEqual(reparsedMembers.methods.length, 1);
});

test('Class Mutations: Stereotype member capabilities (interface, enum, service, abstract)', () => {
  const code = `classDiagram
    class Printable {
        <<interface>>
        +print()
    }
    class Status {
        <<enum>>
        ACTIVE
        INACTIVE
    }
    class AuthService {
        <<service>>
        +login()
    }
    class BaseEntity {
        <<abstract>>
        +id: string
    }
`;
  const ast = parseMermaidClassDiagram(code);

  const ifaceCaps = ClassDiagramDriver.mutations.getNodeMemberCapabilities!(ast, 'Printable');
  assert.strictEqual(ifaceCaps.supportsAttributes, false);
  assert.strictEqual(ifaceCaps.supportsMethods, true);

  const enumCaps = ClassDiagramDriver.mutations.getNodeMemberCapabilities!(ast, 'Status');
  assert.strictEqual(enumCaps.supportsAttributes, true);
  assert.strictEqual(enumCaps.supportsMethods, false);
  assert.strictEqual(enumCaps.attributeLabel, 'Value');

  const srvCaps = ClassDiagramDriver.mutations.getNodeMemberCapabilities!(ast, 'AuthService');
  assert.strictEqual(srvCaps.supportsAttributes, false);
  assert.strictEqual(srvCaps.supportsMethods, true);

  const absCaps = ClassDiagramDriver.mutations.getNodeMemberCapabilities!(ast, 'BaseEntity');
  assert.strictEqual(absCaps.supportsAttributes, true);
  assert.strictEqual(absCaps.supportsMethods, true);
});

test('Class Mutations: Arrow shape consistency between drag-connect and Subclass sprout', () => {
  const code = `classDiagram
    class Base
    class Target
`;
  const ast = parseMermaidClassDiagram(code);

  // 1. Sprout subclass
  const childId = ClassDiagramDriver.mutations.addChildNode(ast, 'Base', 'Derived');
  const sproutRel = ast.relationships.find((r) => r.from === 'Base' && r.to === childId);
  assert.ok(sproutRel);
  assert.strictEqual(sproutRel.rawRelation, '<|--');
  assert.strictEqual(sproutRel.leftEnd, '<|');

  // 2. Drag-to-connect Base -> Target
  ClassDiagramDriver.mutations.connect(ast, 'Base', 'Target');
  const connectRel = ast.relationships.find((r) => r.from === 'Base' && r.to === 'Target');
  assert.ok(connectRel);
  // Must match Subclass arrow shape: <|--
  assert.strictEqual(connectRel.rawRelation, '<|--');
  assert.strictEqual(connectRel.leftEnd, '<|');
  assert.strictEqual(connectRel.lineType, '--');
});

test('Class Mutations: Relationship type updates (arrow, open, dotted, thick, bidirectional)', () => {
  const code = `classDiagram
    class A
    class B
    A <|-- B
`;
  const ast = parseMermaidClassDiagram(code);
  const relId = ast.relationships[0].id;

  // Change to open (-->)
  ClassDiagramDriver.mutations.updateEdgeType?.(ast, relId, 'open');
  assert.strictEqual(ast.relationships[0].rawRelation, '-->');

  // Change to dotted (..|>)
  ClassDiagramDriver.mutations.updateEdgeType?.(ast, relId, 'dotted');
  assert.strictEqual(ast.relationships[0].rawRelation, '..|>');

  // Change to thick (*--)
  ClassDiagramDriver.mutations.updateEdgeType?.(ast, relId, 'thick');
  assert.strictEqual(ast.relationships[0].rawRelation, '*--');

  // Change to bidirectional (<-->)
  ClassDiagramDriver.mutations.updateEdgeType?.(ast, relId, 'bidirectional');
  assert.strictEqual(ast.relationships[0].rawRelation, '<-->');

  // Roundtrip
  const serialized = ClassDiagramDriver.serialize(ast);
  assert.ok(serialized.includes('A <--> B'));
  const reparsed = parseMermaidClassDiagram(serialized);
  assert.strictEqual(reparsed.relationships[0].rawRelation, '<-->');
});

test('Class Mutations: Multiline section editing and syntax auto-handling (setNodeMembers)', () => {
  const code = `classDiagram
    class User {
        +String oldAttr1
        +String oldAttr2
        +oldMethod1()
        +oldMethod2()
    }
`;
  const ast = parseMermaidClassDiagram(code);

  // 1. Edit entire attributes section via multiline lines
  // User typed lines without '+' syntax: "name", "email: string", and an explicit "-id"
  const newAttrLines = [
    'name',
    'email: string',
    '-id',
  ];
  ClassDiagramDriver.mutations.setNodeMembers!(ast, 'User', 'attribute', newAttrLines);

  const membersAfterAttrs = ClassDiagramDriver.mutations.getNodeMembers!(ast, 'User');
  assert.deepEqual(membersAfterAttrs.attributes, [
    '+name',
    '+email: string',
    '-id',
  ]);
  // Methods must remain untouched
  assert.deepEqual(membersAfterAttrs.methods, [
    '+oldMethod1()',
    '+oldMethod2()',
  ]);

  // 2. Edit entire methods section via multiline lines
  // User typed lines without '+' and without '()': "login", "logout(forced)", "getBalance: number", and "-delete"
  const newMethodLines = [
    'login',
    'logout(forced)',
    'getBalance: number',
    '-delete',
  ];
  ClassDiagramDriver.mutations.setNodeMembers!(ast, 'User', 'method', newMethodLines);

  const membersAfterMethods = ClassDiagramDriver.mutations.getNodeMembers!(ast, 'User');
  assert.deepEqual(membersAfterMethods.methods, [
    '+login()',
    '+logout(forced)',
    '+getBalance() : number',
    '-delete()',
  ]);

  // 3. Deleting lines / empty lines removal
  // User removed all attributes except 1
  ClassDiagramDriver.mutations.setNodeMembers!(ast, 'User', 'attribute', ['name', '   ']);
  const membersAfterDelete = ClassDiagramDriver.mutations.getNodeMembers!(ast, 'User');
  assert.deepEqual(membersAfterDelete.attributes, ['+name']);

  // 4. Verify serialization roundtrip
  const serialized = ClassDiagramDriver.serialize(ast);
  assert.ok(serialized.includes('+name'));
  assert.ok(serialized.includes('+login()'));
  assert.ok(serialized.includes('+logout(forced)'));
  assert.ok(serialized.includes('+getBalance() : number'));
  assert.ok(serialized.includes('-delete()'));
  assert.ok(!serialized.includes('oldAttr1'));
  assert.ok(!serialized.includes('oldMethod1'));

  const reparsed = parseMermaidClassDiagram(serialized);
  const reparsedMembers = ClassDiagramDriver.mutations.getNodeMembers!(reparsed, 'User');
  assert.deepEqual(reparsedMembers.attributes, ['+name']);
  assert.strictEqual(reparsedMembers.methods.length, 4);
});

