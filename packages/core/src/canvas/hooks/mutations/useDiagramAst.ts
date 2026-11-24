/**
 * Hook to manage diagram AST state behind the DiagramDriver contract.
 * Holds a single active AST owned by the current driver, projects it to the
 * shared view-model, and applies mutations through driver.clone/serialize.
 */

import { useState, useCallback, useMemo, useLayoutEffect, useRef } from 'react';
import { MermaidEdgeDef, MermaidNodeDef, MermaidSubgraphDef } from '../../../diagrams/viewModel';
import { ConnectionContext, SupportedDiagramType } from '../../../diagrams/types';
import { getDriverOrDefault } from '../../../diagrams/registry';
import type { ConnectionCameraTarget, ConnectionCue } from '../../types';
import type { HostAdapter } from '../../../platform/types';
import { requireDiagramSvg } from '../../renderer/mermaidRenderer';

type VisualEdit = {
  mutate: (ast: unknown) => string | null | void | (() => void);
  cameraTarget?: string | ConnectionCameraTarget;
  cameraRevision: number;
};

export interface ValidatedDiagramRender {
  code: string;
  svg: SVGSVGElement;
  onMounted: () => void;
}

export interface UseDiagramAstOptions {
  code: string;
  setCode: (code: string) => void;
  onCodeChange: (code: string, baseCode: string) => void;
  host: HostAdapter;
  cameraRevision: { current: number };
  pushHistoryState: (code: string) => void;
  diagramType: SupportedDiagramType;
  pinNodeForCamera: (nodeId: string) => void;
  pinConnectionForCamera: (code: string, endpoints: ConnectionCameraTarget) => void;
}

export function useDiagramAst({
  code,
  setCode,
  onCodeChange,
  host,
  cameraRevision,
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
      return null;
    }
  });

  const [syntaxError, setSyntaxError] = useState<string | null>(null);
  const committed = useRef({ code, ast });
  const pendingConnectionCue = useRef<ConnectionCue | null>(null);
  const validatedRender = useRef<ValidatedDiagramRender | null>(null);
  const queue = useRef<{ edits: VisualEdit[]; running: boolean }>({ edits: [], running: false });
  const [isValidating, setIsValidating] = useState(false);

  const cancelVisualEdits = useCallback(() => {
    queue.current = { edits: [], running: false };
    pendingConnectionCue.current = null;
    validatedRender.current = null;
    setIsValidating(false);
  }, []);

  useLayoutEffect(() => () => {
    queue.current = { edits: [], running: false };
  }, []);

  useLayoutEffect(() => {
    if (code === committed.current.code) return;
    cancelVisualEdits();
    try {
      const parsed = driver.parse(code);
      committed.current = { code, ast: parsed };
      setAst(parsed);
      setSyntaxError(null);
    } catch (err: unknown) {
      committed.current = { code, ast: null };
      setSyntaxError(err instanceof Error ? err.message : 'Syntax Error');
    }
  }, [code, driver, cancelVisualEdits]);

  const canvasAst = useMemo(() => ast ?? driver.createEmpty(), [ast, driver]);

  // Projected view-model for the canvas overlays (read-only)
  const projection = useMemo(() => {
    try {
      return driver.project(canvasAst);
    } catch {
      return driver.project(driver.createEmpty());
    }
  }, [driver, canvasAst]);

  const displayNodes: Map<string, MermaidNodeDef> = projection.nodes;
  const displayEdges: MermaidEdgeDef[] = projection.edges;
  const displaySubgraphs: Map<string, MermaidSubgraphDef> = projection.subgraphs;
  const displayDirection = projection.direction || 'LR';

  const enqueueEdit = useCallback(
    (edit: Omit<VisualEdit, 'cameraRevision'>) => {
      const work = queue.current;
      work.edits.push({ ...edit, cameraRevision: cameraRevision.current });
      if (work.running) return;
      work.running = true;
      setIsValidating(true);

      const runNext = async (): Promise<void> => {
        while (work === queue.current) {
          const request = work.edits.shift();
          if (!request) {
            work.running = false;
            setIsValidating(false);
            return;
          }
          const base = committed.current;
          const { cameraTarget } = request;
          const connection = typeof cameraTarget === 'object' ? cameraTarget : null;
          const edgeOrder: string[] | undefined = connection ? [] : undefined;
          let candidate: {
            ast: unknown;
            code: string;
            result: ReturnType<VisualEdit['mutate']>;
            svg: SVGSVGElement;
          };
          try {
            if (base.ast === null) throw new Error('Cannot edit this diagram visually.');
            const nextAst = driver.clone(base.ast);
            const result = request.mutate(nextAst);
            if (connection && typeof result !== 'string') continue;
            const nextCode = driver.serialize(nextAst, edgeOrder);
            if (nextCode === base.code || nextCode === driver.serialize(base.ast)) continue;
            const svg = requireDiagramSvg(await host.renderMermaid(nextCode));
            candidate = { ast: nextAst, code: nextCode, result, svg };
          } catch {
            if (work === queue.current) {
              host.notify('Visual edit could not be saved. The diagram source was kept.');
            }
            continue;
          }
          if (work !== queue.current) return;

          const { code: nextCode, result } = candidate;
          if (request.cameraRevision === cameraRevision.current) {
            if (typeof cameraTarget === 'string') pinNodeForCamera(cameraTarget);
            if (connection) pinConnectionForCamera(nextCode, connection);
          }
          pendingConnectionCue.current = connection && typeof result === 'string'
            ? { code: nextCode, edgeId: result, edgeOrder: edgeOrder?.length ? edgeOrder : undefined }
            : null;
          validatedRender.current = {
            code: nextCode,
            svg: candidate.svg,
            // Mount each edit before measuring the canvas for the next camera correction.
            onMounted: () => { void runNext(); },
          };
          committed.current = { code: nextCode, ast: candidate.ast };
          pushHistoryState(nextCode);
          setCode(nextCode);
          setAst(candidate.ast);
          setSyntaxError(null);
          onCodeChange(nextCode, base.code);
          if (typeof result === 'function') result();
          return;
        }
      };
      void runNext();
    },
    [cameraRevision, driver, host, pinNodeForCamera, pinConnectionForCamera, pushHistoryState, setCode, onCodeChange]
  );
  const applyMutation = useCallback(
    (mutate: (currentAst: unknown) => void | (() => void), cameraTarget?: string) =>
      enqueueEdit({ mutate, cameraTarget }),
    [enqueueEdit]
  );
  const applyDragConnection = useCallback(
    (endpoints: ConnectionCameraTarget, context: ConnectionContext) =>
      enqueueEdit({
        mutate: (next) => driver.mutations.connect(next, endpoints.sourceId, endpoints.targetId, context),
        cameraTarget: endpoints,
      }),
    [enqueueEdit, driver]
  );

  return {
    driver,
    applyDragConnection,
    pendingConnectionCue,
    validatedRender,
    cancelVisualEdits,
    isValidating,
    ast: canvasAst,
    syntaxError,
    setSyntaxError,
    displayNodes,
    displayEdges,
    displaySubgraphs,
    displayDirection,
    applyMutation,
  };
}
