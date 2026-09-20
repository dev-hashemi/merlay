import test from 'node:test';
import assert from 'node:assert';
import {
  findSelectableSvgElement,
  clearViewHighlights,
} from '../src/canvas/interaction/setupViewOnlyInteractivity';

test('View-Only Interactivity: findSelectableSvgElement and clearViewHighlights', () => {
  // Simple DOM mock for Node environment
  class MockTokenList {
    private set = new Set<string>();
    add(...tokens: string[]) {
      tokens.forEach((t) => t && this.set.add(t));
    }
    remove(...tokens: string[]) {
      tokens.forEach((t) => this.set.delete(t));
    }
    contains(token: string): boolean {
      return this.set.has(token);
    }
    has(token: string): boolean {
      return this.set.has(token);
    }
  }

  class MockNode {
    classList = new MockTokenList();
    parentElement: MockNode | null = null;
    children: MockNode[] = [];

    constructor(
      public tagName: string,
      public className: string = '',
      public id: string = ''
    ) {
      if (className) {
        className.split(' ').forEach((c) => c && this.classList.add(c));
      }
    }

    appendChild(child: MockNode) {
      child.parentElement = this;
      this.children.push(child);
      return child;
    }

    contains(node: any): boolean {
      if (node === this) return true;
      for (const ch of this.children) {
        if (ch.contains(node)) return true;
      }
      return false;
    }

    closest(selector: string): MockNode | null {
      let cur: MockNode | null = this;
      while (cur) {
        if (selector.includes('.node') && cur.classList.has('node')) return cur;
        if (selector.includes('.actor') && cur.classList.has('actor')) return cur;
        if (selector.includes('.task') && cur.classList.has('task')) return cur;
        if (selector.includes('g[id]') && cur.tagName === 'g' && cur.id) return cur;
        if (selector.includes('.label') && cur.classList.has('label')) return cur;
        if (selector === 'g' && cur.tagName === 'g') return cur;
        cur = cur.parentElement;
      }
      return null;
    }

    querySelectorAll(selector: string): MockNode[] {
      const results: MockNode[] = [];
      const traverse = (node: MockNode) => {
        for (const ch of node.children) {
          if (selector.includes('.mermaid-view-highlight') && ch.classList.has('mermaid-view-highlight')) {
            results.push(ch);
          }
          traverse(ch);
        }
      };
      traverse(this);
      return results;
    }
  }

  const mountEl = new MockNode('div', 'mermaid-native-svg-mount') as any;
  const svg = mountEl.appendChild(new MockNode('svg')) as any;
  const nodeG = svg.appendChild(new MockNode('g', 'node default', 'class-Dog')) as any;
  const rect = nodeG.appendChild(new MockNode('rect')) as any;
  const text = nodeG.appendChild(new MockNode('text', 'label')) as any;

  // 1. Clicking on <rect> inside .node resolves to the .node group
  const matchedFromRect = findSelectableSvgElement(rect, mountEl);
  assert.strictEqual(matchedFromRect, nodeG);

  // 2. Clicking on <text> inside .node resolves to the .node group
  const matchedFromText = findSelectableSvgElement(text, mountEl);
  assert.strictEqual(matchedFromText, nodeG);

  // 3. Clicking on svg itself returns null
  assert.strictEqual(findSelectableSvgElement(svg, mountEl), null);

  // 4. Clicking on mountEl returns null
  assert.strictEqual(findSelectableSvgElement(mountEl, mountEl), null);

  // 5. clearViewHighlights removes highlight class
  nodeG.classList.add('mermaid-view-highlight');
  assert.strictEqual(nodeG.classList.has('mermaid-view-highlight'), true);
  clearViewHighlights(mountEl);
  assert.strictEqual(nodeG.classList.has('mermaid-view-highlight'), false);
});
