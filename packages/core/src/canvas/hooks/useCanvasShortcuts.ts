import { useState, useEffect } from 'react';
import { CursorMode } from '../types';

export interface UseCanvasShortcutsOptions {
  isEditable?: boolean;
  setCursorMode: (mode: CursorMode) => void;
  handleUndo: () => void;
  handleRedo: () => void;
  handleSelectAll: () => void;
  handleDuplicateSelected: () => void;
  handleCopySelected: () => void;
  handlePasteSelected: () => void;
  handleBatchDeleteSelected: () => void;
  clearSelection: () => void;
  hasActivePopovers: boolean;
  clearActivePopovers: () => void;
  hasSelectedElements: boolean;
  canCopy: boolean;
  handleFitView?: () => void;
  onToggleFullscreen?: () => void;
}

export function useCanvasShortcuts({
  isEditable = true,
  setCursorMode,
  handleUndo,
  handleRedo,
  handleSelectAll,
  handleDuplicateSelected,
  handleCopySelected,
  handlePasteSelected,
  handleBatchDeleteSelected,
  clearSelection,
  hasActivePopovers,
  clearActivePopovers,
  hasSelectedElements,
  canCopy,
  handleFitView,
  onToggleFullscreen,
}: UseCanvasShortcutsOptions) {
  const [isSpacePressed, setIsSpacePressed] = useState<boolean>(false);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const isInputActive =
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA';

      // Spacebar hold to temporarily activate hand pan
      if (e.code === 'Space' && !isInputActive && !e.repeat) {
        e.preventDefault();
        setIsSpacePressed(true);
        return;
      }

      // Hotkey V: Select Mode
      if ((e.key === 'v' || e.key === 'V') && !isInputActive && !e.ctrlKey && !e.metaKey) {
        setCursorMode('select');
        return;
      }

      // Hotkey H: Hand Mode
      if ((e.key === 'h' || e.key === 'H') && !isInputActive && !e.ctrlKey && !e.metaKey) {
        setCursorMode('hand');
        return;
      }

      // Hotkey Ctrl+Z (Undo)
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'z' || e.key === 'Z') && !isInputActive) {
        if (!isEditable) return;
        e.preventDefault();
        handleUndo();
        return;
      }

      // Hotkey Ctrl+Shift+Z or Ctrl+Y (Redo)
      if (
        (e.ctrlKey || e.metaKey) &&
        ((e.shiftKey && (e.key === 'z' || e.key === 'Z')) || e.key === 'y' || e.key === 'Y') &&
        !isInputActive
      ) {
        if (!isEditable) return;
        e.preventDefault();
        handleRedo();
        return;
      }

      // Hotkey Ctrl+A (Select All)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A') && !isInputActive) {
        if (!isEditable) return;
        e.preventDefault();
        handleSelectAll();
        return;
      }

      // Hotkey Ctrl+D (Duplicate Selected)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D') && !isInputActive) {
        if (!isEditable) return;
        e.preventDefault();
        handleDuplicateSelected();
        return;
      }

      // Hotkey Ctrl+C (Copy Selected)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C') && !isInputActive) {
        if (!isEditable) return;
        if (canCopy) {
          e.preventDefault();
          handleCopySelected();
          return;
        }
      }

      // Hotkey Ctrl+V (Paste Selected)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V') && !isInputActive) {
        if (!isEditable) return;
        e.preventDefault();
        handlePasteSelected();
        return;
      }

      // Escape: Dismiss popovers or clear selection
      if (e.key === 'Escape') {
        if (hasActivePopovers) {
          clearActivePopovers();
        } else if (hasSelectedElements) {
          clearSelection();
        }
        return;
      }

      // Delete / Backspace: Delete selected elements
      if ((e.key === 'Delete' || e.key === 'Backspace') && !isInputActive) {
        if (!isEditable) return;
        if (hasSelectedElements) {
          e.preventDefault();
          handleBatchDeleteSelected();
        }
        return;
      }

      // Hotkey Shift+1 or Ctrl+0 (Fit View)
      if (
        ((e.shiftKey && e.key === '!') || ((e.ctrlKey || e.metaKey) && e.key === '0')) &&
        !isInputActive &&
        handleFitView
      ) {
        e.preventDefault();
        handleFitView();
        return;
      }

      // Hotkey Shift+F (Toggle Fullscreen)
      if (
        e.shiftKey &&
        (e.key === 'f' || e.key === 'F') &&
        !e.ctrlKey &&
        !e.metaKey &&
        !isInputActive &&
        onToggleFullscreen
      ) {
        e.preventDefault();
        onToggleFullscreen();
        return;
      }
    };

    const handleGlobalKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    window.addEventListener('keyup', handleGlobalKeyUp);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
      window.removeEventListener('keyup', handleGlobalKeyUp);
    };
  }, [
    setCursorMode,
    handleUndo,
    handleRedo,
    handleSelectAll,
    handleDuplicateSelected,
    handleCopySelected,
    handlePasteSelected,
    handleBatchDeleteSelected,
    clearSelection,
    hasActivePopovers,
    clearActivePopovers,
    hasSelectedElements,
    canCopy,
    handleFitView,
    onToggleFullscreen,
  ]);

  return {
    isSpacePressed,
  };
}
