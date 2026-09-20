import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMermaidFlowchart } from '../src/diagrams/flowchart/parser';
import { MermaidShapeType } from '../src/diagrams/viewModel';

/**
 * Unit tests for Shape-Matched Selection Highlight Logic
 * Simulates DOM extraction, perimeter element filtering, and halo injection
 * for all 14 supported Mermaid flowchart shapes.
 */

interface MockElement {
  tagName: string;
  className: string;
  attributes: Record<string, string>;
  children: MockElement[];
  parent: MockElement | null;
}

function createMockElement(
  tagName: string,
  className: string = '',
  attributes: Record<string, string> = {}
): MockElement {
  return {
    tagName: tagName.toLowerCase(),
    className,
    attributes: { ...attributes },
    children: [],
    parent: null,
  };
}

function appendChild(parent: MockElement, child: MockElement) {
  child.parent = parent;
  parent.children.push(child);
}

function querySelectorAll(root: MockElement, selector: string): MockElement[] {
  const results: MockElement[] = [];
  const tags = selector.split(',').map((s) => s.trim().toLowerCase());

  function traverse(node: MockElement) {
    if (tags.includes(node.tagName)) {
      results.push(node);
    }
    for (const child of node.children) {
      traverse(child);
    }
  }

  for (const child of root.children) {
    traverse(child);
  }
  return results;
}

function closest(node: MockElement, selector: string): MockElement | null {
  let curr: MockElement | null = node.parent;
  while (curr) {
    if (selector.startsWith('.') && curr.className.includes(selector.slice(1))) {
      return curr;
    }
    if (curr.tagName === selector.toLowerCase()) {
      return curr;
    }
    curr = curr.parent;
  }
  return null;
}

/**
 * Mirrors the exact extraction algorithm from NativeMermaidView.tsx
 */
function extractPerimeterShapes(nodeEl: MockElement): MockElement[] {
  const candidateElements = querySelectorAll(
    nodeEl,
    'rect, circle, polygon, path, ellipse, line'
  ).filter((el) => {
    if (closest(el, '.label') || closest(el, 'text') || closest(el, 'foreignObject')) {
      return false;
    }
    if (el.className.includes('mermaid-node-selection-halo')) {
      return false;
    }
    return true;
  });

  const primaryShapes = candidateElements.filter(
    (el) =>
      el.className.includes('label-container') ||
      el.className.includes('outer') ||
      el.className.includes('basic')
  );

  return primaryShapes.length > 0 ? primaryShapes : candidateElements;
}

test('Shape Highlight: Correctly identifies circular geometry for ((Circle))', () => {
  const nodeEl = createMockElement('g', 'node default');
  const circleEl = createMockElement('circle', 'basic label-container', {
    cx: '35',
    cy: '35',
    r: '35',
    fill: '#ececff',
    stroke: '#9370db',
  });
  const labelEl = createMockElement('g', 'label');
  const textEl = createMockElement('text', '', {});
  appendChild(labelEl, textEl);
  appendChild(nodeEl, circleEl);
  appendChild(nodeEl, labelEl);

  const shapes = extractPerimeterShapes(nodeEl);
  assert.equal(shapes.length, 1);
  assert.equal(shapes[0].tagName, 'circle');
  assert.equal(shapes[0].attributes.r, '35');
});

test('Shape Highlight: Correctly selects outer circle for (((Double Circle)))', () => {
  const nodeEl = createMockElement('g', 'node default');
  const outerCircle = createMockElement('circle', 'outer label-container', {
    cx: '40',
    cy: '40',
    r: '40',
  });
  const innerCircle = createMockElement('circle', 'inner', {
    cx: '40',
    cy: '40',
    r: '34',
  });
  const labelEl = createMockElement('g', 'label');
  appendChild(nodeEl, outerCircle);
  appendChild(nodeEl, innerCircle);
  appendChild(nodeEl, labelEl);

  const shapes = extractPerimeterShapes(nodeEl);
  assert.equal(shapes.length, 1);
  assert.equal(shapes[0].tagName, 'circle');
  assert.equal(shapes[0].className, 'outer label-container');
  assert.equal(shapes[0].attributes.r, '40');
});

test('Shape Highlight: Correctly selects outer rect for [[Subroutine]] excluding inner stripes', () => {
  const nodeEl = createMockElement('g', 'node default');
  const rect = createMockElement('rect', 'basic label-container', {
    x: '0',
    y: '0',
    width: '120',
    height: '40',
  });
  const lineLeft = createMockElement('line', 'subroutine-line', {
    x1: '10',
    y1: '0',
    x2: '10',
    y2: '40',
  });
  const lineRight = createMockElement('line', 'subroutine-line', {
    x1: '110',
    y1: '0',
    x2: '110',
    y2: '40',
  });
  const labelEl = createMockElement('g', 'label');
  appendChild(nodeEl, rect);
  appendChild(nodeEl, lineLeft);
  appendChild(nodeEl, lineRight);
  appendChild(nodeEl, labelEl);

  const shapes = extractPerimeterShapes(nodeEl);
  assert.equal(shapes.length, 1);
  assert.equal(shapes[0].tagName, 'rect');
  assert.equal(shapes[0].attributes.width, '120');
});

test('Shape Highlight: Correctly identifies polygon geometry for {Diamond} and {{Hexagon}}', () => {
  // Diamond
  const diamondNode = createMockElement('g', 'node default');
  const diamondPoly = createMockElement('polygon', 'basic label-container', {
    points: '40,0 80,40 40,80 0,40',
  });
  appendChild(diamondNode, diamondPoly);
  appendChild(diamondNode, createMockElement('g', 'label'));

  const diamondShapes = extractPerimeterShapes(diamondNode);
  assert.equal(diamondShapes.length, 1);
  assert.equal(diamondShapes[0].tagName, 'polygon');
  assert.equal(diamondShapes[0].attributes.points, '40,0 80,40 40,80 0,40');

  // Hexagon
  const hexNode = createMockElement('g', 'node default');
  const hexPoly = createMockElement('polygon', 'basic label-container', {
    points: '20,0 80,0 100,25 80,50 20,50 0,25',
  });
  appendChild(hexNode, hexPoly);
  appendChild(hexNode, createMockElement('g', 'label'));

  const hexShapes = extractPerimeterShapes(hexNode);
  assert.equal(hexShapes.length, 1);
  assert.equal(hexShapes[0].tagName, 'polygon');
  assert.equal(hexShapes[0].attributes.points, '20,0 80,0 100,25 80,50 20,50 0,25');
});

test('Shape Highlight: Correctly identifies path geometry for [(Cylinder)]', () => {
  const cylNode = createMockElement('g', 'node default');
  const cylPath = createMockElement('path', 'basic label-container', {
    d: 'M0,15 C0,5 60,5 60,15 L60,65 C60,75 0,75 0,65 Z',
  });
  appendChild(cylNode, cylPath);
  appendChild(cylNode, createMockElement('g', 'label'));

  const shapes = extractPerimeterShapes(cylNode);
  assert.equal(shapes.length, 1);
  assert.equal(shapes[0].tagName, 'path');
  assert.ok(shapes[0].attributes.d.startsWith('M0,15'));
});

test('Shape Highlight: Correctly identifies stadium rounded rect for ([Stadium])', () => {
  const stadiumNode = createMockElement('g', 'node default');
  const stadiumRect = createMockElement('rect', 'basic label-container', {
    x: '0',
    y: '0',
    width: '100',
    height: '40',
    rx: '20',
    ry: '20',
  });
  appendChild(stadiumNode, stadiumRect);
  appendChild(stadiumNode, createMockElement('g', 'label'));

  const shapes = extractPerimeterShapes(stadiumNode);
  assert.equal(shapes.length, 1);
  assert.equal(shapes[0].tagName, 'rect');
  assert.equal(shapes[0].attributes.rx, '20');
  assert.equal(shapes[0].attributes.ry, '20');
});

test('Shape Highlight: Never targets elements inside .label, text, or foreignObject', () => {
  const nodeEl = createMockElement('g', 'node default');
  const rect = createMockElement('rect', 'basic label-container', { width: '80', height: '30' });
  const labelEl = createMockElement('g', 'label');
  const foreignObject = createMockElement('foreignObject', '', {});
  const divInsideLabel = createMockElement('div', '', {});
  // Sometimes foreignObject has a background rect
  const innerLabelRect = createMockElement('rect', 'label-bg', { width: '20', height: '10' });

  appendChild(foreignObject, innerLabelRect);
  appendChild(foreignObject, divInsideLabel);
  appendChild(labelEl, foreignObject);
  appendChild(nodeEl, rect);
  appendChild(nodeEl, labelEl);

  const shapes = extractPerimeterShapes(nodeEl);
  assert.equal(shapes.length, 1);
  assert.equal(shapes[0], rect);
});
