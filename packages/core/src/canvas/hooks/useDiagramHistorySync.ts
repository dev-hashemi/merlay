import { useRef, useEffect, useCallback } from 'react';
import { useCanvasStore } from '../store/canvasStore';

export interface UseDiagramHistorySyncProps {
  initialCode?: string;
  code: string;
  setCode: (code: string) => void;
  onCodeChange: (code: string) => void;
  showCodeDrawer: boolean;
  pushHistoryState: (code: string) => void;
  undoHistory: () => string | null;
  redoHistory: () => string | null;
  resetHistory: (code: string) => void;
  setSyntaxError: (err: string | null) => void;
  updateSelectedNodeHalo: (targets?: string | null | Set<string> | string[]) => void;
  updateSelectedEdgeHalo: (targets?: string | null | Set<string> | string[]) => void;
  svgMountRef: React.RefObject<HTMLDivElement | null>;
}

export function useDiagramHistorySync({
  initialCode,
  code,
  setCode,
  onCodeChange,
  showCodeDrawer,
  pushHistoryState,
  undoHistory,
  redoHistory,
  resetHistory,
  setSyntaxError,
  updateSelectedNodeHalo,
  updateSelectedEdgeHalo,
  svgMountRef,
}: UseDiagramHistorySyncProps) {
  const resetTransientUiState = useCallback(() => {
    useCanvasStore.getState().resetTransientUiState();
    updateSelectedNodeHalo(new Set());
    updateSelectedEdgeHalo(new Set());
    if (svgMountRef.current) {
      svgMountRef.current
        .querySelectorAll('.mermaid-cluster-selected, .mermaid-view-highlight')
        .forEach((c) => {
          c.classList.remove('mermaid-cluster-selected');
          c.classList.remove('mermaid-view-highlight');
        });
    }
  }, [updateSelectedNodeHalo, updateSelectedEdgeHalo, svgMountRef]);

  // File switches reuse this component with a new initialCode prop, but
  // useState/useHistory seed once. Without this sync the view keeps showing
  // the old diagram and undo replays the old file's code into the new file.
  const lastInitialCodeRef = useRef<string | null>(null);
  // Live mirror of the code on screen, so write-back echoes (hosts that
  // round-trip our own edits back through the initialCode prop, e.g. the
  // VS Code document sync) are not mistaken for file switches.
  const codeRef = useRef(code);
  codeRef.current = code;
  useEffect(() => {
    if (lastInitialCodeRef.current === null) {
      lastInitialCodeRef.current = initialCode ?? null;
      return;
    }
    if (initialCode !== lastInitialCodeRef.current) {
      lastInitialCodeRef.current = initialCode ?? null;
      const next =
        initialCode || 'flowchart LR\n    A["Start"] --> B["Process"]\n    B --> C["End"]';
      // Echo of what we already show: keep history (undo/redo) and selection.
      // Compared whitespace-insensitively: the serializer emits a trailing
      // newline but fence write-back trims it, so the round-tripped echo
      // always differs by surrounding whitespace from the code on screen.
      if (next.trim() === codeRef.current.trim()) return;
      resetHistory(next);
      setCode(next);
      resetTransientUiState();
    }
  }, [initialCode, resetHistory, setCode, resetTransientUiState]);

  const handleUndo = useCallback(() => {
    const prevCode = undoHistory();
    if (prevCode === null) return;
    setCode(prevCode);
    setSyntaxError(null);
    onCodeChange(prevCode);
    resetTransientUiState();
  }, [undoHistory, setCode, setSyntaxError, onCodeChange, resetTransientUiState]);

  const handleRedo = useCallback(() => {
    const nextCode = redoHistory();
    if (nextCode === null) return;
    setCode(nextCode);
    setSyntaxError(null);
    onCodeChange(nextCode);
    resetTransientUiState();
  }, [redoHistory, setCode, setSyntaxError, onCodeChange, resetTransientUiState]);

  // SyntaxDrawer edits bypass applyMutation, so record a single history
  // entry when the drawer closes instead of flooding the stack per keystroke.
  // Without this, undo after a drawer edit jumps to the pre-drawer state
  // and silently discards the drawer text.
  const drawerOpenCodeRef = useRef<string | null>(null);
  const wasDrawerOpenRef = useRef(showCodeDrawer);
  useEffect(() => {
    if (showCodeDrawer && !wasDrawerOpenRef.current) {
      drawerOpenCodeRef.current = code;
    } else if (!showCodeDrawer && wasDrawerOpenRef.current) {
      if (drawerOpenCodeRef.current !== null && drawerOpenCodeRef.current !== code) {
        pushHistoryState(code);
      }
      drawerOpenCodeRef.current = null;
    }
    wasDrawerOpenRef.current = showCodeDrawer;
  });

  return {
    handleUndo,
    handleRedo,
    resetTransientUiState,
  };
}
