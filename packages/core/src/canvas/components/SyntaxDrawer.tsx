import React from 'react';
import { CloseIcon } from '../icons/Icons';

export interface SyntaxDrawerProps {
  isOpen: boolean;
  code: string;
  syntaxError: string | null;
  onClose: () => void;
  onChangeCode: (newCode: string) => void;
  readOnly?: boolean;
}

export const SyntaxDrawer: React.FC<SyntaxDrawerProps> = ({
  isOpen,
  code,
  syntaxError,
  onClose,
  onChangeCode,
  readOnly = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="mermaid-side-code-drawer nodrag">
      <div className="mermaid-code-drawer-header">
        <span>Mermaid Syntax{readOnly ? ' (View Only)' : ''}</span>
        <button
          type="button"
          className="mermaid-code-close-btn"
          onClick={onClose}
          title="Close Syntax Drawer"
        >
          <CloseIcon size={14} />
        </button>
      </div>
      {syntaxError && (
        <div className="mermaid-code-error-badge">{syntaxError}</div>
      )}
      <textarea
        className="mermaid-code-drawer-textarea"
        value={code}
        readOnly={readOnly}
        onChange={(e) => {
          if (!readOnly) onChangeCode(e.target.value);
        }}
        spellCheck={false}
      />
    </div>
  );
};
