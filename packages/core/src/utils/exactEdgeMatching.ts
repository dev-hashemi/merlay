import type { EdgeStrokeContext, SvgDomAdapter } from '../diagrams/types';
import type { MermaidEdgeDef } from '../diagrams/viewModel';

interface ConnectionStrokeOptions extends Omit<EdgeStrokeContext, 'edge' | 'edges'> {
  edgeId: string;
  edgeOrder?: readonly string[];
  displayEdges: readonly MermaidEdgeDef[];
  peleEdges: readonly SVGGraphicsElement[];
  dom?: SvgDomAdapter;
}

export function resolveConnectionStroke({
  edgeId, edgeOrder, displayEdges, nodes, paths, peleEdges, dom,
}: ConnectionStrokeOptions): SVGGraphicsElement | null {
  const byId = new Map(displayEdges.map((edge) => [edge.id, edge]));
  if (byId.size !== displayEdges.length) return null;
  const edge = byId.get(edgeId);
  if (!edge) return null;
  const edges = edgeOrder
    ? edgeOrder.map((id) => byId.get(id)).filter((entry): entry is MermaidEdgeDef => !!entry)
    : displayEdges;
  if (edgeOrder && edges.length !== edgeOrder.length) return null;

  const context = { edge, edges, nodes, paths };
  if (peleEdges.length) {
    const group = resolveOrderedStroke(context, peleEdges);
    return group ? findUniqueStroke(paths, (path) => path.closest('.pele-edge') === group) : null;
  }
  return (dom?.resolveEdgeStroke ?? resolveEndpointStroke)(context);
}

export function nativeEdgeId(path: SVGGraphicsElement): string {
  const group = path.closest('g.edgePath');
  const id = path.getAttribute('data-id') || path.id || group?.id || '';
  const mountId = path.ownerSVGElement?.id;
  return mountId && id.startsWith(mountId + '-') ? id.slice(mountId.length + 1) : id;
}

export function findUniqueStroke(
  paths: readonly SVGGraphicsElement[],
  matches: (path: SVGGraphicsElement) => boolean,
): SVGGraphicsElement | null {
  const matching = paths.filter(matches);
  return matching.length === 1 ? matching[0] : null;
}

function resolveOrderedStroke(
  { edge, edges }: EdgeStrokeContext,
  paths: readonly SVGGraphicsElement[],
): SVGGraphicsElement | null {
  return paths.length === edges.length ? paths[edges.indexOf(edge)] ?? null : null;
}

export function resolveStateStroke(context: EdgeStrokeContext): SVGGraphicsElement | null {
  const { paths, edges, edge } = context;
  const transitions = paths.filter((path) => /^edge\d+$/.test(nativeEdgeId(path)));
  if (transitions.length !== edges.length) return null;
  const ids = new Set(transitions.map(nativeEdgeId));
  if (!edges.every((_, i) => ids.has(`edge${i}`))) return null;
  return findUniqueStroke(transitions, (path) => nativeEdgeId(path) === `edge${edges.indexOf(edge)}`);
}

export function resolveSequenceStroke(context: EdgeStrokeContext): SVGGraphicsElement | null {
  const messages = context.paths.filter((path) =>
    path.classList.contains('messageLine0') || path.classList.contains('messageLine1')
  );
  return resolveOrderedStroke(context, messages);
}

function resolveEndpointStroke(
  { edge, paths, edges }: EdgeStrokeContext,
): SVGGraphicsElement | null {
  const parallel = edges.filter(({ from, to }) => from === edge.from && to === edge.to);
  const prefixes = [
    `L_${edge.from}_${edge.to}_`,
    `L-${edge.from}-${edge.to}-`,
    `id_${edge.from}_${edge.to}_`,
  ];
  const indexed = paths.flatMap((path) => {
    const id = nativeEdgeId(path);
    const prefix = prefixes.find((candidate) => id.startsWith(candidate) &&
      /^\d+$/.test(id.slice(candidate.length)));
    return prefix ? [{ path, index: Number(id.slice(prefix.length)) }] : [];
  });

  // Distinct node pairs can produce the same compound renderer ID.
  const ambiguous = edges.some(({ from, to }) => (from !== edge.from || to !== edge.to) &&
    (from + '_' + to === edge.from + '_' + edge.to || from + '-' + to === edge.from + '-' + edge.to));
  if (ambiguous) return null;

  if (indexed.length === parallel.length &&
      new Set(indexed.map(({ index }) => index)).size === parallel.length) {
    indexed.sort((a, b) => a.index - b.index);
    return indexed[parallel.indexOf(edge)]?.path ?? null;
  }
  if (parallel.length !== 1 || indexed.length > 0) return null;

  return findUniqueStroke(paths, (path) => {
    const classes = path.closest('g.edgePath')?.classList;
    return [path.classList, classes].some((tokens) =>
      tokens?.contains(`LS_${edge.from}`) && tokens.contains(`LE_${edge.to}`)
    );
  });
}
