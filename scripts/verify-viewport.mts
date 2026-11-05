/// <reference types="node" />

import assert from 'node:assert/strict';

import {
  canvasToScreen,
  clampScale,
  IDENTITY_VIEWPORT,
  isIdentityViewport,
  MAX_ZOOM,
  MIN_ZOOM,
  panViewport,
  resetViewport,
  screenToCanvas,
  zoomViewportAt,
  type Viewport,
} from '../src/canvas/viewport.ts';

function close(actual: number, expected: number, epsilon = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `expected ${expected}, got ${actual}`);
}

function assertPoint(actual: { x: number; y: number }, expected: { x: number; y: number }) {
  close(actual.x, expected.x);
  close(actual.y, expected.y);
}

// Screen ↔ canvas conversion round-trips at every supported scale.
for (const scale of [MIN_ZOOM, 0.75, 1, 2.5, MAX_ZOOM]) {
  const viewport: Viewport = { x: 180, y: -90, scale };
  for (const point of [{ x: 0, y: 0 }, { x: 12, y: 48 }, { x: -760, y: 1320 }]) {
    assertPoint(canvasToScreen(screenToCanvas(point, viewport), viewport), point);
  }
}

// Pan is a pure screen-space translation at every zoom level.
for (const scale of [MIN_ZOOM, 1, 2.5, MAX_ZOOM]) {
  const panned = panViewport({ x: 10, y: 20, scale }, -35, 15);
  assertPoint({ x: panned.x, y: panned.y }, { x: -25, y: 35 });
  close(panned.scale, scale);
}

// Zoom limits hold for both explicit clamping and focal zoom.
close(clampScale(0.01), MIN_ZOOM);
close(clampScale(99), MAX_ZOOM);
close(clampScale(Number.NaN), 1);

// Pinch zoom keeps the canvas point under the focal point fixed at every zoom level.
for (const startScale of [MIN_ZOOM, 1, 2.5, MAX_ZOOM]) {
  for (const nextScale of [0.1, 0.75, 1.4, 3.2, 100]) {
    const start: Viewport = { x: 40, y: -25, scale: startScale };
    const focal = { x: 150, y: 260 };
    const anchor = screenToCanvas(focal, start);
    const zoomed = zoomViewportAt(start, focal, nextScale);
    assertPoint(screenToCanvas(focal, zoomed), anchor);
    close(zoomed.scale, clampScale(nextScale));
  }
}

// Reset restores the identity viewport.
const reset = resetViewport();
assert.deepEqual(reset, IDENTITY_VIEWPORT);
assert.equal(isIdentityViewport(reset), true);
assert.equal(isIdentityViewport({ x: 0, y: 0, scale: 1.1 }), false);

console.log('viewport checks passed: conversion, pan, zoom limits, focal anchoring, reset');
