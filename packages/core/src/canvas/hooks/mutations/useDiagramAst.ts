/**
 * Hook to manage diagram AST state behind the DiagramDriver contract.
 * Holds a single active AST owned by the current driver, projects it to the
 * shared view-model, and applies mutations through driver.clone/serialize.
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { MermaidEdgeDef, MermaidNodeDef, MermaidSubgraphDef } from '../../../diagrams/viewModel';
import { ConnectionContext, SupportedDiagramType } from '../../../diagrams/types';
import { getDriverOrDefault } from '../../../diagrams/registry';
import type { ConnectionCameraTarget, ConnectionCue } from '../../types';

export interface UseDiagramAstOptions {
  code: string;
  setCode: (code: string) => void;
  onCodeChange: (code: string) => void;
  pushHistoryState: (code: string) => void;
  diagramType: SupportedDiagramType;
  pinNodeForCamera: (nodeId: string) => void;
  pinConnectionForCamera: (code: string, endpoints: ConnectionCameraTarget) => void;
}

export function useDiagramAst({
  code,
  setCode,
  onCodeChange,
  pushHistoryState,
  diagramType,
  pinNodeForCamera,
  pinConnectionForCamera,
}: UseDiagramAstOptions) {
  const driver = getDriverOrDefault(diagramType);

  // The single active AST. Re-parsed whenever code changes from outside this
  // hook (undo/redo, syntax drawer, external edits) — never when we emitted
  // the change ourselves via applyMutation.
  const [ast, setAst] = useState<unknown>(() => {
    try {
      return driver.parse(code);
    } catch {
      return driver.createEmpty();
    }
  });

  const [syntaxError, setSyntaxError] = useState<string | null>(null);
  const lastEmittedCodeRef = useRef<string>(code);
  const pendingConnectionCue = useRef<ConnectionCue | null>(null);

  useEffect(() => {
    if (code === lastEmittedCodeRef.current) return;
    lastEmittedCodeRef.current = code;
    try {
      setAst(driver.parse(code));
      setSyntaxError(null);
    } catch (err: unknown) {
      setSyntaxError(err instanceof Error ? err.message : 'Syntax Error');
    }
  }, [code, driver]);

  // Projected view-model for the canvas overlays (read-only)
  const projection = useMemo(() => {
    try {
      return driver.project(ast);
    } catch {
      return driver.project(driver.createEmpty());
    }
  }, [driver, ast]);

  const displayNodes: Map<string, MermaidNodeDef> = projection.nodes;
  const displayEdges: MermaidEdgeDef[] = projection.edges;
  const displaySubgraphs: Map<string, MermaidSubgraphDef> = projection.subgraphs;
  const displayDirection = projection.direction || 'LR';

  // Apply a mutation: clone the committed AST, mutate the clone, serialize
  // and emit. Never mutates the current AST in place.
  const commitMutation = useCallback(
    (mutator: (currentAst: unknown) => unknown, cameraTarget?: string | ConnectionCameraTarget) => {
      try {
        const next = driver.clone(ast);
        const result = mutator(next);
        const connection = typeof cameraTarget === 'object' ? cameraTarget : null;
        if (connection && typeof result !== 'string') return;
        const edgeOrder = connection ? [] : undefined;
        const serialized = driver.serialize(next, edgeOrder);
        if (typeof cameraTarget === 'string') {
          pinNodeForCamera(cameraTarget);
        } else if (connection && typeof result === 'string') {
          if (serialized === code) return;
          pinConnectionForCamera(serialized, connection);
          pendingConnectionCue.current = {
            code: serialized, edgeId: result, edgeOrder: edgeOrder?.length ? edgeOrder : undefined,
          };
        }
        if (!connection && serialized !== code) pendingConnectionCue.current = null;
        lastEmittedCodeRef.current = serialized;
        pushHistoryState(serialized);
        setCode(serialized);
        setAst(next);
        setSyntaxError(null);
        onCodeChange(serialized);
      } catch (err: unknown) {
        console.error('AST Mutation Error:', err);
      }
    },
    [ast, code, driver, pinNodeForCamera, pinConnectionForCamera, pushHistoryState, setCode, onCodeChange]
  );
  const applyMutation = useCallback(
    (mutator: (currentAst: unknown) => void, keepNodeId?: string) => commitMutation(mutator, keepNodeId),
    [commitMutation]
  );
  const applyDragConnection = useCallback(
    (endpoints: ConnectionCameraTarget, context: ConnectionContext) =>
      commitMutation((next) => driver.mutations.connect(next, endpoints.sourceId, endpoints.targetId, context), endpoints),
    [commitMutation, driver]
  );

  return {
    driver,
    applyDragConnection,
    pendingConnectionCue,
    ast,
    syntaxError,
    setSyntaxError,
    displayNodes,
    displayEdges,
    displaySubgraphs,
    displayDirection,
    applyMutation,
  };
}
