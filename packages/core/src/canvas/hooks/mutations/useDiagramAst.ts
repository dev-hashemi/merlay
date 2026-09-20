/**
 * Hook to manage diagram AST state behind the DiagramDriver contract.
 * Holds a single active AST owned by the current driver, projects it to the
 * shared view-model, and applies mutations through driver.clone/serialize.
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { MermaidEdgeDef, MermaidNodeDef, MermaidSubgraphDef } from '../../../diagrams/viewModel';
import { SupportedDiagramType } from '../../../diagrams/types';
import { getDriverOrDefault } from '../../../diagrams/registry';

export interface UseDiagramAstOptions {
  code: string;
  setCode: (code: string) => void;
  onCodeChange: (code: string) => void;
  pushHistoryState: (code: string) => void;
  diagramType: SupportedDiagramType;
  pinNodeForCamera: (nodeId: string) => void;
}

export function useDiagramAst({
  code,
  setCode,
  onCodeChange,
  pushHistoryState,
  diagramType,
  pinNodeForCamera,
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
  const applyMutation = useCallback(
    (mutator: (currentAst: unknown) => void, keepNodeId?: string) => {
      try {
        if (keepNodeId) pinNodeForCamera(keepNodeId);
        const next = driver.clone(ast);
        mutator(next);
        const serialized = driver.serialize(next);
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
    [ast, driver, pinNodeForCamera, pushHistoryState, setCode, onCodeChange]
  );

  return {
    driver,
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
