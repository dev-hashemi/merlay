import { Rect } from '../types';
import { attachTapGestures, guardClickAfterLongPress } from './touchGestures';
import { applyStyles, createSvgElement } from '../../platform/dom';

export interface SetupLifelineHitAreaOptions {
  htmlEl: SVGGraphicsElement;
  targetNodeId: string;
  getLocalRect: (el: Element) => Rect | null;
  getLocalPoint?: (clientX: number, clientY: number) => { x: number; y: number } | null;
  onSelectNode: (targetNodeId: string, isMulti: boolean, htmlEl: Element) => void;
  onStartEditingNode: (nodeId: string, nodeEl: Element) => void;
  onHoverNode: (nodeId: string, rect: Rect | null, startEndKind?: 'start' | 'end' | null) => void;
}

/**
 * For vertical lifelines, attaches an invisible 28px hit area overlay to make selection
 * and drag-to-connect dropping effortless anywhere along the column timeline.
 */
export function setupLifelineHitArea({
  htmlEl,
  targetNodeId,
  getLocalRect,
  getLocalPoint,
  onSelectNode,
  onStartEditingNode,
  onHoverNode,
}: SetupLifelineHitAreaOptions): void {
  const lineEl = htmlEl;
  const isPath = lineEl.tagName.toLowerCase() === 'path';
  const hitArea = createSvgElement(isPath ? 'path' : 'line');
  if (isPath) {
    hitArea.setAttribute('d', lineEl.getAttribute('d') || '');
  } else {
    for (const attr of ['x1', 'y1', 'x2', 'y2']) hitArea.setAttribute(attr, lineEl.getAttribute(attr) || '0');
  }
  hitArea.setAttribute('class', 'mermaid-lifeline-hit-area');
  hitArea.setAttribute('data-mermaid-node-id', targetNodeId);
  hitArea.setAttribute('fill', 'none');
  hitArea.setAttribute('stroke', 'transparent');
  hitArea.setAttribute('stroke-width', '28');
  applyStyles(hitArea, { cursor: 'pointer', pointerEvents: 'stroke' });

  const updateLifelineHover = (e: MouseEvent) => {
    const lineRect = getLocalRect(lineEl);
    if (!lineRect) return;
    const pt = getLocalPoint ? getLocalPoint(e.clientX, e.clientY) : null;
    const lineCenterX = lineRect.x + lineRect.width / 2;
    const targetY = pt ? pt.y : lineRect.y + lineRect.height / 2;

    // Clamp to lifeline span with 12px margin
    const clampedY = Math.max(
      lineRect.y + 12,
      Math.min(lineRect.y + lineRect.height - 12, targetY)
    );

    // When isLR is false, ConnectionHandle places handle at:
    // posX = rect.x + rect.width / 2
    // posY = rect.y + rect.height
    // Setting width = 20, height = 10 puts the handle dot precisely at (lineCenterX, clampedY).
    const handleRect: Rect = {
      x: lineCenterX - 10,
      y: clampedY - 10,
      width: 20,
      height: 10,
    };
    onHoverNode(targetNodeId, handleRect, null);
  };

  hitArea.onclick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const isMulti = e.shiftKey || e.metaKey || e.ctrlKey;
    onSelectNode(targetNodeId, isMulti, htmlEl);
  };
  hitArea.ondblclick = (e: MouseEvent) => {
    e.stopPropagation();
    onStartEditingNode(targetNodeId, htmlEl);
  };
  // Touch: double-tap renames. Long-press never selects (HUD opens on single
  // tap only) — the no-op arms release-click suppression while hold-then-drag
  // flows into drag-connect.
  const lifelineTap = attachTapGestures(hitArea, {
    onDoubleTap: () => onStartEditingNode(targetNodeId, htmlEl),
    onLongPress: () => undefined,
  });
  guardClickAfterLongPress(hitArea, lifelineTap);

  hitArea.onmouseenter = updateLifelineHover;
  hitArea.onmousemove = updateLifelineHover;
  lineEl.onmouseenter = updateLifelineHover;
  lineEl.onmousemove = updateLifelineHover;

  htmlEl.parentNode?.insertBefore(hitArea, htmlEl.nextSibling);
}
