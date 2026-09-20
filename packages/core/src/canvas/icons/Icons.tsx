import React from 'react';

export interface IconProps {
  size?: number;
  className?: string;
  strokeWidth?: number;
}

const createIcon = (
  content: React.ReactNode,
  defaultViewBox = '0 0 24 24'
): React.FC<IconProps> => {
  return ({ size = 15, className = '', strokeWidth = 2 }) => (
    <svg
      width={size}
      height={size}
      viewBox={defaultViewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {content}
    </svg>
  );
};

export const PlusIcon = createIcon(
  <>
    <path d="M5 12h14" />
    <path d="M12 5v14" />
  </>
);

export const LinkIcon = createIcon(
  <>
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </>
);

export const CardIcon = createIcon(<rect width="18" height="18" x="3" y="3" rx="2" />);

export const UserIcon = createIcon(
  <>
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </>
);

export const ShapesIcon = createIcon(
  <>
    <path d="M8.3 10a.7.7 0 0 1-.626-.382l-3.5-7A.7.7 0 0 1 4.8 1.618h7a.7.7 0 0 1 .626 1.000l-3.5 7A.7.7 0 0 1 8.3 10Z" />
    <rect width="7" height="7" x="14" y="3" rx="1" />
    <circle cx="8" cy="17" r="4" />
    <polygon points="17 14 20 20 14 20" />
  </>
);

export const FolderIcon = createIcon(<rect width="18" height="18" x="3" y="3" rx="2" strokeDasharray="4 3" />);

export const PaletteIcon = createIcon(
  <>
    <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
    <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
    <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
    <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
  </>
);

export const PencilIcon = createIcon(
  <>
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    <path d="m15 5 4 4" />
  </>
);

export const TrashIcon = createIcon(
  <>
    <path d="M3 6h18" />
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    <line x1="10" x2="10" y1="11" y2="17" />
    <line x1="14" x2="14" y1="11" y2="17" />
  </>
);

export const UngroupIcon = createIcon(
  <>
    <rect width="8" height="8" x="2" y="2" rx="1" />
    <rect width="8" height="8" x="14" y="14" rx="1" />
    <path d="M14 6h2a2 2 0 0 1 2 2v2" />
    <path d="M6 14H4a2 2 0 0 0-2 2v2" />
  </>
);

export const WandIcon = createIcon(
  <>
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    <path d="M5 3v4" />
    <path d="M19 17v4" />
    <path d="M3 5h4" />
    <path d="M17 19h4" />
  </>
);

export const UndoIcon = createIcon(
  <>
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11" />
  </>
);

export const RedoIcon = createIcon(
  <>
    <path d="m15 14 5-5-5-5" />
    <path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5v0A5.5 5.5 0 0 0 9.5 20H13" />
  </>
);

export const CopyIcon = createIcon(
  <>
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
  </>
);

export const CodeIcon = createIcon(
  <>
    <polyline points="16 18 22 12 16 6" />
    <polyline points="8 6 2 12 8 18" />
  </>
);

export const ImageIcon = createIcon(
  <>
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <circle cx="9" cy="9" r="2" />
    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
  </>
);

export const VectorIcon = createIcon(
  <>
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
    <path d="m10 13-2 2 2 2" />
    <path d="m14 17 2-2-2-2" />
  </>
);

export const MaximizeIcon = createIcon(
  <>
    <polyline points="15 3 21 3 21 9" />
    <polyline points="9 21 3 21 3 15" />
    <line x1="21" y1="3" x2="14" y2="10" />
    <line x1="3" y1="21" x2="10" y2="14" />
  </>
);

export const MinimizeIcon = createIcon(
  <>
    <polyline points="4 14 10 14 10 20" />
    <polyline points="20 10 14 10 14 4" />
    <line x1="14" y1="10" x2="21" y2="3" />
    <line x1="3" y1="21" x2="10" y2="14" />
  </>
);

export const ExportIcon = createIcon(
  <>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </>
);

export const DownloadIcon = createIcon(
  <>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </>
);

export const ReverseIcon = createIcon(
  <>
    <path d="m7 16-4-4 4-4" />
    <path d="M3 12h18" />
    <path d="m17 8 4 4-4 4" />
  </>
);

export const FitViewIcon = createIcon(
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M3 7V5a2 2 0 0 1 2-2h2" />
    <path d="M17 3h2a2 2 0 0 1 2 2v2" />
    <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
    <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
  </>
);

export const ChevronDownIcon = createIcon(<path d="m6 9 6 6 6-6" />);
export const CloseIcon = createIcon(
  <>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </>
);

export const AlertWarningIcon = createIcon(
  <>
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </>
);

export const EditDiagramIcon = createIcon(
  <>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
  </>
);

export const ArrowSolidIcon = createIcon(
  <>
    <line x1="3" y1="12" x2="20" y2="12" />
    <polyline points="15 7 20 12 15 17" />
  </>
);

export const ArrowDottedIcon = createIcon(
  <>
    <line x1="3" y1="12" x2="20" y2="12" strokeDasharray="3 3" />
    <polyline points="15 7 20 12 15 17" />
  </>
);

export const ArrowThickIcon = createIcon(
  <>
    <line x1="3" y1="12" x2="19" y2="12" />
    <polyline points="14 7 19 12 14 17" strokeWidth="2.5" />
  </>
);

export const ArrowBidirectionalIcon = createIcon(
  <>
    <polyline points="8 7 3 12 8 17" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <polyline points="16 7 21 12 16 17" />
  </>
);

export const ArrowOpenIcon = createIcon(<line x1="3" y1="12" x2="21" y2="12" />);

export const InsertStepIcon = createIcon(
  <>
    <circle cx="12" cy="12" r="9" />
    <line x1="12" y1="8" x2="12" y2="16" />
    <line x1="8" y1="12" x2="16" y2="12" />
  </>
);

export const CheckIcon = createIcon(<polyline points="20 6 9 17 4 12" />);

export const SelectModeIcon = createIcon(
  <>
    <path d="m3 3 7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
    <path d="m13 13 6 6" />
  </>
);

export const HandModeIcon = createIcon(
  <>
    <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
    <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2" />
    <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" />
    <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
  </>
);

export const CheckSquareIcon = createIcon(
  <>
    <polyline points="9 11 12 14 22 4" />
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </>
);

const createShape = (content: React.ReactNode) => {
  return ({ size = 14 }: { size?: number } = {}) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {content}
    </svg>
  );
};

export const ShapeIcons = {
  rectangle: createShape(<rect x="3" y="5" width="18" height="14" rx="2" />),
  rounded: createShape(<rect x="3" y="5" width="18" height="14" rx="6" />),
  stadium: createShape(<rect x="2" y="6" width="20" height="12" rx="6" />),
  cylinder: createShape(
    <>
      <ellipse cx="12" cy="6" rx="9" ry="3" />
      <path d="M3 6v12c0 1.66 4.03 3 9 3s9-1.34 9-3V6" />
    </>
  ),
  circle: createShape(<circle cx="12" cy="12" r="9" />),
  double_circle: createShape(
    <>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
    </>
  ),
  diamond: createShape(<polygon points="12,2 22,12 12,22 2,12" />),
  hexagon: createShape(<polygon points="6,3 18,3 23,12 18,21 6,21 1,12" />),
  subroutine: createShape(
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <line x1="7" y1="5" x2="7" y2="19" />
      <line x1="17" y1="5" x2="17" y2="19" />
    </>
  ),
  parallelogram: createShape(<polygon points="7,5 22,5 17,19 2,19" />),
  parallelogram_alt: createShape(<polygon points="2,5 17,5 22,19 7,19" />),
  trapezoid: createShape(<polygon points="6,5 18,5 22,19 2,19" />),
  trapezoid_alt: createShape(<polygon points="2,5 22,5 18,19 6,19" />),
  asymmetric: createShape(<polygon points="2,5 18,5 22,12 18,19 2,19" />),
  cloud: createShape(<path d="M17.5 19H7a4.5 4.5 0 0 1-.7-8.94A6 6 0 0 1 17.6 8.5 4 4 0 0 1 17.5 19Z" />),
  bang: createShape(<polygon points="12,2 14.5,7.5 20,4.5 18,10.5 23,12 18,13.5 20,19.5 14.5,16.5 12,22 9.5,16.5 4,19.5 6,13.5 1,12 6,10.5 4,4.5 9.5,7.5" />),
  default: createShape(<rect x="3" y="6" width="18" height="12" rx="3" strokeDasharray="3 3" />),
};

export const StateTypeIcons = {
  normal: createShape(<rect x="3" y="5" width="18" height="14" rx="4" />),
  start: ({ size = 14 }: { size?: number } = {}) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="12" r="7" />
    </svg>
  ),
  end: ({ size = 14 }: { size?: number } = {}) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" fill="currentColor" stroke="none" />
    </svg>
  ),
  choice: ({ size = 14 }: { size?: number } = {}) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="12,3 21,12 12,21 3,12" />
    </svg>
  ),
  fork: ({ size = 14 }: { size?: number } = {}) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <rect x="3" y="10" width="18" height="4" rx="2" />
    </svg>
  ),
  join: ({ size = 14 }: { size?: number } = {}) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <rect x="3" y="10" width="18" height="4" rx="2" />
    </svg>
  ),
};

export const MerlayLogoIcon: React.FC<IconProps> = ({
  size = 16,
  className = '',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 100 100"
    fill="currentColor"
    className={className}
  >
    <g
      transform="translate(-193.941, 185.061) scale(0.026991, -0.026991)"
      fill="currentColor"
      stroke="none"
    >
      <path d="M9717 6473 c-4 -3 -7 -106 -7 -227 0 -122 -4 -226 -8 -232 -5 -7 -80 -11 -225 -11 -155 -1 -222 -5 -232 -13 -21 -17 -22 -277 -2 -304 12 -17 34 -19 230 -22 120 -1 222 -6 227 -9 6 -4 10 -91 10 -225 0 -207 1 -220 19 -230 11 -5 82 -10 160 -10 128 0 141 2 151 19 6 12 10 106 10 235 l0 216 219 0 c121 0 226 3 235 6 14 5 16 29 16 164 0 88 -3 161 -8 164 -4 2 -100 5 -212 6 -113 1 -215 5 -227 7 l-23 5 0 222 c0 159 -3 225 -12 234 -13 13 -309 18 -321 5z" />
      <path d="M8003 5999 c-103 -8 -186 -51 -285 -151 -43 -43 -78 -84 -78 -92 0 -8 -6 -21 -13 -28 -19 -18 -44 -99 -57 -178 -14 -94 -14 -1503 1 -1589 7 -36 20 -86 31 -110 44 -104 152 -222 248 -271 98 -50 106 -51 975 -47 885 3 860 1 965 63 91 53 220 203 220 256 0 7 8 27 18 43 15 27 17 75 20 505 2 261 0 485 -3 497 -6 23 -6 23 -168 21 l-162 -3 -5 -465 c-5 -439 -6 -468 -24 -495 -28 -43 -37 -50 -89 -74 -45 -21 -55 -21 -792 -21 -735 0 -747 0 -795 21 -32 14 -58 34 -77 62 l-28 40 0 771 c0 424 3 783 7 797 9 31 64 93 93 103 11 4 226 7 478 6 337 -1 463 2 473 11 11 9 14 45 14 166 0 134 -2 154 -17 160 -20 8 -852 10 -950 2z" />
    </g>
  </svg>
);

export const RowsIcon = createIcon(
  <>
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </>
);
