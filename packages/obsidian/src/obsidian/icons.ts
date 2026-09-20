import { addIcon } from 'obsidian';

export const MERLAY_ICON_ID = 'merlay-logo';
export const MERLAY_ICON_ALIAS = 'merlay';

/**
 * Custom Merlay inverted outline glyph icon, calibrated for Obsidian's 0 0 100 100 icon viewBox.
 * Consists of the node path and plus sprout mark with fill="currentColor" to seamlessly match
 * Obsidian's ribbon, menus, tabs, and button iconography in light and dark modes.
 */
export const MERLAY_ICON_SVG_CONTENT = `
<g transform="translate(-193.941, 185.061) scale(0.026991, -0.026991)" fill="currentColor" stroke="none">
  <path d="M9717 6473 c-4 -3 -7 -106 -7 -227 0 -122 -4 -226 -8 -232 -5 -7 -80 -11 -225 -11 -155 -1 -222 -5 -232 -13 -21 -17 -22 -277 -2 -304 12 -17 34 -19 230 -22 120 -1 222 -6 227 -9 6 -4 10 -91 10 -225 0 -207 1 -220 19 -230 11 -5 82 -10 160 -10 128 0 141 2 151 19 6 12 10 106 10 235 l0 216 219 0 c121 0 226 3 235 6 14 5 16 29 16 164 0 88 -3 161 -8 164 -4 2 -100 5 -212 6 -113 1 -215 5 -227 7 l-23 5 0 222 c0 159 -3 225 -12 234 -13 13 -309 18 -321 5z"/>
  <path d="M8003 5999 c-103 -8 -186 -51 -285 -151 -43 -43 -78 -84 -78 -92 0 -8 -6 -21 -13 -28 -19 -18 -44 -99 -57 -178 -14 -94 -14 -1503 1 -1589 7 -36 20 -86 31 -110 44 -104 152 -222 248 -271 98 -50 106 -51 975 -47 885 3 860 1 965 63 91 53 220 203 220 256 0 7 8 27 18 43 15 27 17 75 20 505 2 261 0 485 -3 497 -6 23 -6 23 -168 21 l-162 -3 -5 -465 c-5 -439 -6 -468 -24 -495 -28 -43 -37 -50 -89 -74 -45 -21 -55 -21 -792 -21 -735 0 -747 0 -795 21 -32 14 -58 34 -77 62 l-28 40 0 771 c0 424 3 783 7 797 9 31 64 93 93 103 11 4 226 7 478 6 337 -1 463 2 473 11 11 9 14 45 14 166 0 134 -2 154 -17 160 -20 8 -852 10 -950 2z"/>
</g>
`.trim();

/**
 * Register the custom Merlay icons into Obsidian's icon library.
 * Once registered, MERLAY_ICON_ID ('merlay-logo') can be used in:
 * - addRibbonIcon
 * - setIcon
 * - Menu.addItem.setIcon
 * - View.getIcon
 */
export function registerMerlayIcons(): void {
  addIcon(MERLAY_ICON_ID, MERLAY_ICON_SVG_CONTENT);
  addIcon(MERLAY_ICON_ALIAS, MERLAY_ICON_SVG_CONTENT);
}
