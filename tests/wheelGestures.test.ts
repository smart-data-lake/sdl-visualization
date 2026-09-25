import { describe, expect, test } from 'vitest';
import { applyWheelAction, guessWheelDevice, wheelAction, zoomAround } from '../src/util/ConfigExplorer/wheelGestures';

const wheel = (deltaX: number, deltaY: number, extra: Partial<WheelEvent> = {}) =>
  ({ deltaX, deltaY, deltaMode: 0, ctrlKey: false, metaKey: false, shiftKey: false, ...extra });

describe('guessWheelDevice', () => {
  test('a wheel notch is a mouse', () => {
    expect(guessWheelDevice(wheel(0, 100))).toBe('mouse');
    expect(guessWheelDevice(wheel(0, -53))).toBe('mouse');
    expect(guessWheelDevice(wheel(0, 3, { deltaMode: 1 }))).toBe('mouse');
  });

  test('small, fractional or sideways steps are a touchpad', () => {
    expect(guessWheelDevice(wheel(0, 4))).toBe('touchpad');
    expect(guessWheelDevice(wheel(0, 120.5))).toBe('touchpad');
    expect(guessWheelDevice(wheel(12, 60))).toBe('touchpad');
  });

  test('shift+wheel scrolls sideways with a mouse', () => {
    expect(guessWheelDevice(wheel(100, 0, { shiftKey: true }))).toBe('mouse');
  });
});

describe('wheelAction', () => {
  test('a touchpad slide pans in both directions', () => {
    expect(wheelAction(wheel(10, -20), 'touchpad')).toEqual({ type: 'pan', dx: -10, dy: 20 });
  });

  test('a pinch zooms, spreading the fingers zooms in', () => {
    const zoomIn = wheelAction(wheel(0, -5, { ctrlKey: true }), 'touchpad');
    expect(zoomIn.type).toBe('zoom');
    expect(zoomIn.type === 'zoom' && zoomIn.factor).toBeCloseTo(Math.exp(0.05));
  });

  test('a mouse wheel zooms as ReactFlow does, with or without Ctrl', () => {
    const plain = wheelAction(wheel(0, 100), 'mouse');
    const ctrl = wheelAction(wheel(0, 100, { ctrlKey: true }), 'mouse');
    expect(plain).toEqual({ type: 'zoom', factor: Math.pow(2, -0.2) });
    expect(ctrl).toEqual(plain);
  });
});

describe('viewport', () => {
  test('zooming keeps the point under the pointer in place', () => {
    const viewport = { x: 10, y: 20, zoom: 0.5 };
    const point = { x: 200, y: 100 };
    const zoomed = zoomAround(viewport, point, 2, 0.02, 1);
    const graphPoint = (v: typeof viewport) => ({ x: (point.x - v.x) / v.zoom, y: (point.y - v.y) / v.zoom });
    expect(zoomed.zoom).toBe(1);
    expect(graphPoint(zoomed).x).toBeCloseTo(graphPoint(viewport).x);
    expect(graphPoint(zoomed).y).toBeCloseTo(graphPoint(viewport).y);
  });

  test('zoom is clamped', () => {
    expect(zoomAround({ x: 0, y: 0, zoom: 0.8 }, { x: 0, y: 0 }, 4, 0.02, 1).zoom).toBe(1);
    expect(zoomAround({ x: 0, y: 0, zoom: 0.03 }, { x: 0, y: 0 }, 0.1, 0.02, 1).zoom).toBe(0.02);
  });

  test('panning moves the viewport, not the zoom', () => {
    expect(applyWheelAction({ x: 5, y: 5, zoom: 0.4 }, { type: 'pan', dx: -10, dy: 3 }, { x: 0, y: 0 }, 0.02, 1))
      .toEqual({ x: -5, y: 8, zoom: 0.4 });
  });
});
