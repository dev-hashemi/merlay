import { SvgDomAdapter } from '../types';

export const stateDomAdapter: SvgDomAdapter = {
  nodeIdPrefixes: ['state-'],
  anchorSelectors:
    '.state-start, .state-end, [id*="root_start"], [id*="root_end"], [id*="_start"], [id*="_end"]',
  anchorNodeId: '[*]',
  isAnchorElement(el) {
    const idAttr = el.getAttribute('id') || '';
    return (
      el.classList.contains('state-start') ||
      el.classList.contains('state-end') ||
      idAttr.includes('root_start') ||
      idAttr.includes('root_end') ||
      idAttr.includes('_start') ||
      idAttr.includes('_end') ||
      el.classList.contains('outer-path') ||
      !!el.querySelector?.('.outer-path')
    );
  },
  getAnchorKind(el) {
    const attr = el.getAttribute('data-mermaid-start-end');
    if (attr === 'start' || attr === 'end') return attr;
    const container = el.closest('g.node, g') || el;
    const idAttr = container.getAttribute('id') || el.getAttribute('id') || '';
    const match = idAttr.match(/^(?:state-)?(.+)_(start|end)(?:-\d+)?$/);
    if (match) {
      return match[2] as 'start' | 'end';
    }
    if (idAttr.includes('root_start') || idAttr.includes('_start-') || idAttr.endsWith('_start')) return 'start';
    if (idAttr.includes('root_end') || idAttr.includes('_end-') || idAttr.endsWith('_end')) return 'end';
    if (el.classList.contains('state-start')) return 'start';
    if (el.classList.contains('state-end')) return 'end';
    try {
      if (el.querySelector('.state-start')) return 'start';
      if (el.querySelector('.state-end')) return 'end';
      if (el.querySelector('.outer-path')) return 'end';
    } catch {
      /* ignore */
    }
    return null;
  },
  getAnchorCompositeId(el) {
    const container = el.closest('g.node, g') || el;
    const idAttr = container.getAttribute('id') || el.getAttribute('id') || '';
    const match =
      idAttr.match(/(?:^|-)state-(.+?)_(?:start|end)(?:-\d+)?$/) ||
      idAttr.match(/^(.+?)_(?:start|end)(?:-\d+)?$/);
    if (match && match[1] !== 'root') {
      return match[1];
    }
    const clusterEl = el.closest('[data-mermaid-subgraph-id]');
    if (clusterEl) {
      const subId = clusterEl.getAttribute('data-mermaid-subgraph-id');
      if (subId) return subId;
    }
    return null;
  },
};
