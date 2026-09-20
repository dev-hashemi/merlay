import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Pure math reference function matching useCanvasCamera's handleFitView algorithm.
 */
function calculateFitView({
  containerWidth,
  containerHeight,
  svgWidth,
  svgHeight,
  svgWorldX = 80,
  svgWorldY = 80,
}: {
  containerWidth: number;
  containerHeight: number;
  svgWidth: number;
  svgHeight: number;
  svgWorldX?: number;
  svgWorldY?: number;
}) {
  if (containerWidth <= 0 || containerHeight <= 0 || svgWidth <= 0 || svgHeight <= 0) {
    return { zoom: 1, pan: { x: 0, y: 0 } };
  }

  const padX = 80;
  const topBarHeight = 60;
  const padBottom = 40;

  const availWidth = Math.max(containerWidth - padX, 100);
  const availHeight = Math.max(containerHeight - (topBarHeight + padBottom), 100);

  const fitScale = Math.min(availWidth / svgWidth, availHeight / svgHeight);
  const newZoom = Math.min(Math.max(fitScale, 0.15), 1.15);

  const diagramCenterX = svgWorldX + svgWidth / 2;
  const panX = containerWidth / 2 - diagramCenterX * newZoom;

  const diagramCenterY = svgWorldY + svgHeight / 2;
  const targetCenterY = topBarHeight + availHeight / 2;
  const panY = targetCenterY - diagramCenterY * newZoom;

  return {
    zoom: newZoom,
    pan: { x: Math.round(panX), y: Math.round(panY) },
  };
}

test('Fit View Math: Centers a standard diagram horizontally with equal margins', () => {
  const containerWidth = 1200;
  const containerHeight = 800;
  const svgWidth = 600;
  const svgHeight = 300;

  const res = calculateFitView({
    containerWidth,
    containerHeight,
    svgWidth,
    svgHeight,
  });

  const scaledW = svgWidth * res.zoom;
  const screenLeft = res.pan.x + 80 * res.zoom;
  const screenRight = containerWidth - (screenLeft + scaledW);

  assert.ok(Math.abs(screenLeft - screenRight) <= 1, `Left (${screenLeft}) and right (${screenRight}) margins must be equal (centered)`);
  assert.ok(res.zoom <= 1.15, 'Zoom should be clamped to avoid over-magnifying small diagrams');
});

test('Fit View Math: Downscales large overflowing diagram to fit visible bounds', () => {
  const containerWidth = 1000;
  const containerHeight = 700;
  const svgWidth = 2500;
  const svgHeight = 1800;

  const res = calculateFitView({
    containerWidth,
    containerHeight,
    svgWidth,
    svgHeight,
  });

  const scaledW = svgWidth * res.zoom;
  const scaledH = svgHeight * res.zoom;

  assert.ok(res.zoom < 1, `Zoom must be less than 1 (was ${res.zoom})`);
  assert.ok(scaledW <= 1000 - 80, `Scaled width ${scaledW} must fit within avail width ${1000 - 80}`);
  assert.ok(scaledH <= 700 - (60 + 40), `Scaled height ${scaledH} must fit within avail height`);
  assert.ok(res.pan.x > 0, 'Pan X should be centered with positive margin');
});

test('Fit View Math: Graceful fallback on zero dimensions', () => {
  const res = calculateFitView({
    containerWidth: 0,
    containerHeight: 0,
    svgWidth: 100,
    svgHeight: 100,
  });

  assert.equal(res.zoom, 1);
  assert.deepEqual(res.pan, { x: 0, y: 0 });
});
