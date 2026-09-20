import React from 'react';
import { SelectionBox } from '../types';

export interface SelectionMarqueeProps {
  box: SelectionBox | null;
}

export const SelectionMarquee: React.FC<SelectionMarqueeProps> = ({ box }) => {
  if (!box) return null;

  const left = Math.min(box.startX, box.currentX);
  const top = Math.min(box.startY, box.currentY);
  const width = Math.abs(box.currentX - box.startX);
  const height = Math.abs(box.currentY - box.startY);

  return (
    <div
      className="mermaid-selection-marquee"
      style={{
        left,
        top,
        width,
        height,
      }}
    />
  );
};
