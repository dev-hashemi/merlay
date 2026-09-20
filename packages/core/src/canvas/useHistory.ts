import { useState, useCallback, useRef } from 'react';
import { HistoryManager } from './historyManager';

export interface HistoryState {
  canUndo: boolean;
  canRedo: boolean;
  pushState: (state: string) => void;
  undo: () => string | null;
  redo: () => string | null;
  reset: (initialState: string) => void;
}

/**
 * Hook for managing undo/redo stack of serialized Mermaid code.
 * Keeps up to maxDepth snapshots in past stack.
 */
export function useHistory(initialState: string, maxDepth: number = 50): HistoryState {
  const managerRef = useRef<HistoryManager<string>>(
    new HistoryManager<string>(initialState, maxDepth)
  );

  const [, setRevision] = useState<number>(0);
  const notify = () => setRevision((r) => r + 1);

  const pushState = useCallback((nextState: string) => {
    managerRef.current.push(nextState);
    notify();
  }, []);

  const undo = useCallback((): string | null => {
    const res = managerRef.current.undo();
    if (res !== null) notify();
    return res;
  }, []);

  const redo = useCallback((): string | null => {
    const res = managerRef.current.redo();
    if (res !== null) notify();
    return res;
  }, []);

  const reset = useCallback((initial: string) => {
    managerRef.current.reset(initial);
    notify();
  }, []);

  return {
    canUndo: managerRef.current.canUndo,
    canRedo: managerRef.current.canRedo,
    pushState,
    undo,
    redo,
    reset,
  };
}
