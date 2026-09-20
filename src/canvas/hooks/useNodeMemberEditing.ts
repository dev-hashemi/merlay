import { useCallback } from 'react';
import { DiagramDriver } from '../../diagrams/types';
import { Rect } from '../types';

export function getCompartmentRect(
  nodeEl: Element,
  kind: 'attribute' | 'method',
  getLocalRect: (el: Element) => Rect | null
): Rect | null {
  const nodeRect = getLocalRect(nodeEl);
  if (!nodeRect) return null;

  const targetGroup = nodeEl.querySelector(
    kind === 'attribute' ? '.members-group' : '.methods-group'
  );
  if (targetGroup && targetGroup.children.length > 0) {
    const groupRect = getLocalRect(targetGroup);
    if (groupRect && groupRect.height > 10) {
      return {
        x: nodeRect.x + 6,
        y: Math.max(nodeRect.y, groupRect.y - 2),
        width: Math.max(nodeRect.width - 12, 140),
        height: Math.max(groupRect.height + 8, 56),
      };
    }
  }

  // Fallback to dividers if present
  const dividers = Array.from(nodeEl.querySelectorAll('.divider'));
  if (dividers.length >= 2) {
    const d0Rect = getLocalRect(dividers[0]);
    const d1Rect = getLocalRect(dividers[1]);
    if (d0Rect && d1Rect) {
      if (kind === 'attribute') {
        const top = d0Rect.y + 2;
        const height = Math.max(d1Rect.y - top, 56);
        return {
          x: nodeRect.x + 6,
          y: top,
          width: Math.max(nodeRect.width - 12, 140),
          height,
        };
      } else {
        const top = d1Rect.y + 2;
        const height = Math.max(nodeRect.y + nodeRect.height - top - 4, 56);
        return {
          x: nodeRect.x + 6,
          y: top,
          width: Math.max(nodeRect.width - 12, 140),
          height,
        };
      }
    }
  }

  // Ratio-based fallback: top 35% header, 35%-65% attributes, 65%-100% methods
  if (kind === 'attribute') {
    return {
      x: nodeRect.x + 6,
      y: nodeRect.y + nodeRect.height * 0.35,
      width: Math.max(nodeRect.width - 12, 140),
      height: Math.max(nodeRect.height * 0.3, 56),
    };
  } else {
    return {
      x: nodeRect.x + 6,
      y: nodeRect.y + nodeRect.height * 0.65,
      width: Math.max(nodeRect.width - 12, 140),
      height: Math.max(nodeRect.height * 0.35, 56),
    };
  }
}

export interface UseNodeMemberEditingProps {
  driver: DiagramDriver;
  ast: unknown;
  isEditable: boolean;
  getLocalRect: (el: Element) => Rect | null;
  svgMountRef: React.RefObject<HTMLDivElement | null>;
  startEditingNode: (nodeId: string, nodeEl: Element) => void;
  startEditingMemberSection: (
    nodeId: string,
    kind: 'attribute' | 'method',
    pos: Rect,
    initialText: string
  ) => void;
}

export function useNodeMemberEditing({
  driver,
  ast,
  isEditable,
  getLocalRect,
  svgMountRef,
  startEditingNode,
  startEditingMemberSection,
}: UseNodeMemberEditingProps) {
  const handleOpenMemberSection = useCallback(
    (nodeId: string, kind: 'attribute' | 'method', nodeEl: Element) => {
      const caps = driver.mutations.getNodeMemberCapabilities?.(ast, nodeId);
      if (kind === 'attribute' && caps && !caps.supportsAttributes) return;
      if (kind === 'method' && caps && !caps.supportsMethods) return;

      const members = driver.mutations.getNodeMembers?.(ast, nodeId) || {
        attributes: [],
        methods: [],
      };
      const lines = kind === 'attribute' ? members.attributes : members.methods;
      const initialText = lines.join('\n');

      const pos = getCompartmentRect(nodeEl, kind, getLocalRect);
      if (pos) {
        startEditingMemberSection(nodeId, kind, pos, initialText);
      }
    },
    [driver, ast, getLocalRect, startEditingMemberSection]
  );

  const handleAddNodeAttribute = useCallback(
    (nodeId: string) => {
      const nodeEl = svgMountRef.current?.querySelector(
        `[data-mermaid-node-id="${nodeId}"], [id*="-classId-${nodeId}-"]`
      );
      if (nodeEl) {
        handleOpenMemberSection(nodeId, 'attribute', nodeEl);
      }
    },
    [handleOpenMemberSection, svgMountRef]
  );

  const handleAddNodeMethod = useCallback(
    (nodeId: string) => {
      const nodeEl = svgMountRef.current?.querySelector(
        `[data-mermaid-node-id="${nodeId}"], [id*="-classId-${nodeId}-"]`
      );
      if (nodeEl) {
        handleOpenMemberSection(nodeId, 'method', nodeEl);
      }
    },
    [handleOpenMemberSection, svgMountRef]
  );

  const handleStartEditingNode = useCallback(
    (nodeId: string, nodeEl: Element, event?: MouseEvent | TouchEvent) => {
      if (!isEditable) return;

      const targetEl = (event as MouseEvent)?.target as Element | undefined;

      // 1. Check if user clicked on title area -> rename class / node
      const titleEl = targetEl?.closest('.label-group') || targetEl?.closest('.annotation-group');
      if (titleEl) {
        if (driver.mutations.isNodeTextEditable(ast, nodeId)) {
          startEditingNode(nodeId, targetEl?.closest('.label-group') || nodeEl);
        }
        return;
      }

      // 2. Class diagram member compartments (attributes or methods)
      if (driver.capabilities.supportsNodeMembers && driver.mutations.getNodeMembers) {
        const caps = driver.mutations.getNodeMemberCapabilities?.(ast, nodeId) || {
          supportsAttributes: true,
          supportsMethods: true,
        };

        // Direct hit on members-group or methods-group (or any of their children)
        const hitMembers = targetEl?.closest('.members-group');
        const hitMethods = targetEl?.closest('.methods-group');

        if (hitMembers && caps.supportsAttributes) {
          handleOpenMemberSection(nodeId, 'attribute', nodeEl);
          return;
        }
        if (hitMethods && caps.supportsMethods) {
          handleOpenMemberSection(nodeId, 'method', nodeEl);
          return;
        }

        // Stereotype constraints: interface/service has methods only, enum has values only
        if (!caps.supportsAttributes && caps.supportsMethods) {
          handleOpenMemberSection(nodeId, 'method', nodeEl);
          return;
        }
        if (caps.supportsAttributes && !caps.supportsMethods) {
          handleOpenMemberSection(nodeId, 'attribute', nodeEl);
          return;
        }

        // Both supported: inspect relative click position
        if (event && 'clientY' in event) {
          const rect = nodeEl.getBoundingClientRect();
          const relY = (event.clientY - rect.top) / Math.max(1, rect.height);
          if (relY < 0.35) {
            // Top 35% -> rename class
            if (driver.mutations.isNodeTextEditable(ast, nodeId)) {
              startEditingNode(nodeId, nodeEl);
            }
            return;
          } else if (relY < 0.65) {
            // Middle -> attributes
            handleOpenMemberSection(nodeId, 'attribute', nodeEl);
            return;
          } else {
            // Bottom -> methods
            handleOpenMemberSection(nodeId, 'method', nodeEl);
            return;
          }
        }
      }

      // Default fallback: regular node rename
      if (driver.mutations.isNodeTextEditable(ast, nodeId)) {
        startEditingNode(nodeId, nodeEl);
      }
    },
    [isEditable, driver, ast, startEditingNode, handleOpenMemberSection]
  );

  return {
    handleOpenMemberSection,
    handleAddNodeAttribute,
    handleAddNodeMethod,
    handleStartEditingNode,
  };
}
