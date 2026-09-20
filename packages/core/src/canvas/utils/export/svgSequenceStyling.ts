/**
 * Sequence diagram element styling for export.
 */

/**
 * Applies sequence diagram theme parity styling for actors, lines, and sequence numbers.
 */
export function styleSequenceElements(
  svg: SVGSVGElement,
  isDark: boolean,
  defaultActorFill: string,
  defaultActorStroke: string
): void {
  svg.querySelectorAll('rect.actor, .actor rect, .actor-box rect, g.actor rect').forEach((shape) => {
    shape.setAttribute('fill', defaultActorFill);
    shape.setAttribute('stroke', defaultActorStroke);
    if (!shape.getAttribute('stroke-width')) {
      shape.setAttribute('stroke-width', '1.5');
    }
  });

  svg.querySelectorAll('.actor-man line').forEach((line) => {
    line.setAttribute('stroke', defaultActorStroke);
    line.setAttribute('stroke-width', '2');
    line.setAttribute('fill', 'none');
  });
  svg.querySelectorAll('.actor-man circle').forEach((circle) => {
    circle.setAttribute('stroke', defaultActorStroke);
    circle.setAttribute('stroke-width', '2');
    circle.setAttribute('fill', defaultActorFill);
  });

  svg.querySelectorAll('line.actor-line, .actor-line').forEach((line) => {
    line.setAttribute('stroke', defaultActorStroke);
    line.setAttribute('stroke-width', '1.5');
    line.setAttribute('fill', 'none');
  });

  svg.querySelectorAll('.sequenceNumber, text.sequenceNumber').forEach((textEl) => {
    textEl.setAttribute('fill', '#000000');
    textEl.setAttribute('font-weight', 'bold');
  });
}
