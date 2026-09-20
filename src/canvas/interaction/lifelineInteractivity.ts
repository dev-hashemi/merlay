import { Rect } from '../types';
import { attachTapGestures, guardClickAfterLongPress } from './touchGestures';

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
  const lineEl = htmlEl as unknown as SVGLineElement;
  const hitArea = createSvg('line');
  hitArea.setAttribute('x1', lineEl.getAttribute('x1') || '0');
  hitArea.setAttribute('y1', lineEl.getAttribute('y1') || '0');
  hitArea.setAttribute('x2', lineEl.getAttribute('x2') || '0');
  hitArea.setAttribute('y2', lineEl.getAttribute('y2') || '0');
  hitArea.setAttribute('class', 'mermaid-lifeline-hit-area');
  hitArea.setAttribute('data-mermaid-node-id', targetNodeId);
  hitArea.setAttribute('fill', 'none');
  hitArea.setAttribute('stroke', 'transparent');
  hitArea.setAttribute('stroke-width', '28');
  hitArea.setCssStyles({ cursor: 'pointer', pointerEvents: 'stroke' });

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

  hitArea.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const isMulti = e.shiftKey || e.metaKey || e.ctrlKey;
    onSelectNode(targetNodeId, isMulti, htmlEl);
  };
  hitArea.ondblclick = (e) => {
    e.stopPropagation();
    onStartEditingNode(targetNodeId, htmlEl);
  };
  const lifelineTap = attachTapGestures(hitArea, {
    onDoubleTap: () => onStartEditingNode(targetNodeId, htmlEl),
    onLongPress: () => onSelectNode(targetNodeId, true, htmlEl),
  });
  guardClickAfterLongPress(hitArea, lifelineTap);

  hitArea.onmouseenter = updateLifelineHover;
  hitArea.onmousemove = updateLifelineHover;
  lineEl.onmouseenter = updateLifelineHover;
  lineEl.onmousemove = updateLifelineHover;

  htmlEl.parentNode?.insertBefore(hitArea, htmlEl.nextSibling);
}
