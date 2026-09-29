import { useCallback } from 'react';
import { useCanvasStore } from '../../store/canvasStore';
import { DiagramDriver } from '../../../diagrams/types';
import { ThemePreset } from '../../constants';

export interface UseNodeStyleMutationsOptions {
  driver: DiagramDriver;
  ast: unknown;
  applyMutation: (mutator: (currentAst: unknown) => void, keepNodeId?: string) => void;
  getSelectedNodeId: () => string | null;
}

export function useNodeStyleMutations({
  driver,
  ast,
  applyMutation,
  getSelectedNodeId,
}: UseNodeStyleMutationsOptions) {
  const m = driver.mutations;

  const handleApplyNodePreset = useCallback(
    (preset: ThemePreset, specificId?: unknown) => {
      const state = useCanvasStore.getState();
      const validSpecificId = typeof specificId === 'string' && specificId ? specificId : null;
      const targets = validSpecificId
        ? [validSpecificId]
        : state.selectedNodeIds.size > 0
        ? Array.from(state.selectedNodeIds)
        : getSelectedNodeId()
        ? [getSelectedNodeId()!]
        : [];

      applyMutation((a) => {
        if (!preset.fill && !preset.stroke && !preset.color) {
          m.clearNodesStyle(a, targets);
        } else {
          const styles: Record<string, string> = {};
          if (preset.fill) styles['fill'] = preset.fill;
          if (preset.stroke) styles['stroke'] = preset.stroke;
          if (preset.color) styles['color'] = preset.color;
          m.updateNodesStyle(a, targets, styles);
        }
      }, validSpecificId || getSelectedNodeId() || undefined);
    },
    [m, applyMutation, getSelectedNodeId]
  );

  const handleUpdateCustomStyle = useCallback(
    (property: string, value: string, specificId?: unknown) => {
      const target =
        (typeof specificId === 'string' && specificId ? specificId : null) ||
        getSelectedNodeId();
      if (!target) return;

      applyMutation((a) => {
        const currentStyle = m.getNodeStyle(a, target) || {};
        const updated = { ...currentStyle };
        if (value) {
          updated[property] = value;
        } else {
          delete updated[property];
        }
        m.updateNodeStyle(a, target, Object.keys(updated).length > 0 ? updated : null);
      }, target);
    },
    [m, applyMutation, getSelectedNodeId]
  );

  const handleClearNodeStyle = useCallback(
    (specificId?: unknown) => {
      const target =
        (typeof specificId === 'string' && specificId ? specificId : null) ||
        getSelectedNodeId();
      if (!target) return;

      applyMutation((a) => {
        m.clearNodeStyle(a, target);
      }, target);
    },
    [m, applyMutation, getSelectedNodeId]
  );

  const handleSetDefaultNodeStyle = useCallback(
    (customStyle?: unknown) => {
      if (!m.updateDefaultStyle) return;
      const target = getSelectedNodeId();
      applyMutation((a) => {
        const isStyleMap =
          customStyle &&
          typeof customStyle === 'object' &&
          !('nativeEvent' in customStyle) &&
          !('isTrusted' in customStyle) &&
          !('bubbles' in customStyle);

        const styleToSet =
          (isStyleMap ? (customStyle as Record<string, string>) : undefined) ||
          (target ? m.getNodeStyle(a, target) : undefined);

        if (styleToSet && Object.keys(styleToSet).length > 0) {
          m.updateDefaultStyle!(a, styleToSet);
          const state = useCanvasStore.getState();
          const nodeTargets =
            state.selectedNodeIds.size > 0
              ? Array.from(state.selectedNodeIds)
              : target
              ? [target]
              : [];
          if (nodeTargets.length > 0) {
            m.clearNodesStyle(a, nodeTargets);
          }
        }
      });
    },
    [m, applyMutation, getSelectedNodeId]
  );

  const handleClearDefaultNodeStyle = useCallback(() => {
    if (!m.clearDefaultStyle) return;
    applyMutation((a) => {
      m.clearDefaultStyle!(a);
    });
  }, [m, applyMutation]);

  const classDefs = m.getClassDefs ? m.getClassDefs(ast) : undefined;
  const selectedNodeId = getSelectedNodeId();
  const nodeClasses = m.getNodeClasses && selectedNodeId ? m.getNodeClasses(ast, selectedNodeId) : undefined;

  const handleToggleNodeClass = useCallback(
    (className: string, specificId?: unknown) => {
      if (!m.toggleNodeClass) return;
      const target =
        (typeof specificId === 'string' && specificId ? specificId : null) ||
        getSelectedNodeId();
      if (!target) return;

      applyMutation((a) => {
        m.toggleNodeClass!(a, target, className);
      }, target);
    },
    [m, applyMutation, getSelectedNodeId]
  );

  const handleSaveClassDef = useCallback(
    (name: string, styles: Record<string, string>) => {
      if (!m.setClassDef) return;
      const target = getSelectedNodeId();
      applyMutation((a) => {
        m.setClassDef!(a, name, styles);
        if (target && m.setNodeClasses) {
          const currentClasses = m.getNodeClasses?.(a, target) || [];
          if (!currentClasses.includes(name)) {
            m.setNodeClasses(a, target, [...currentClasses, name]);
          }
        }
      }, target || undefined);
    },
    [m, applyMutation, getSelectedNodeId]
  );

  const handleDeleteClassDef = useCallback(
    (name: string) => {
      if (!m.deleteClassDef) return;
      applyMutation((a) => {
        m.deleteClassDef!(a, name);
      }, getSelectedNodeId() || undefined);
    },
    [m, applyMutation, getSelectedNodeId]
  );

  return {
    handleApplyNodePreset,
    handleUpdateCustomStyle,
    handleClearNodeStyle,
    handleSetDefaultNodeStyle,
    handleClearDefaultNodeStyle,
    hasDefaultNodeStyle: Boolean(m.getDefaultStyle?.(ast)),
    classDefs,
    nodeClasses,
    handleToggleNodeClass,
    handleSaveClassDef,
    handleDeleteClassDef,
  };
}
