/** Prefer an editable header over a participant's lifeline or mirrored footer. */
export function findNodeEditElement(mount: Element | null, nodeId: string): Element | null {
  const selector = `[data-mermaid-node-id="${nodeId}"]`;
  const source = `${selector}:not(.mermaid-node-selection-halo):not(.mermaid-drop-target-halo)`;
  return mount?.querySelector(`${source}.actor-top`) ?? mount?.querySelector(
    `${source}:not(.actor-line):not(.mermaid-lifeline-hit-area):not(.actor-bottom):not(.pele-lifeline):not(.pele-actor-footer)`
  ) ?? mount?.querySelector(source) ?? null;
}
