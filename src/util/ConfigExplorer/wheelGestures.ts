/*
    Classifies wheel events of the lineage graph and turns them into viewport changes: a pinch or a
    Ctrl/Cmd+wheel zooms, a touchpad slide pans, a mouse wheel zooms as before.
    See "Touchpad and mouse wheel" in src/components/ConfigExplorer/LineageTab/README.md.
*/

export type Viewport = { x: number, y: number, zoom: number };
export type WheelDevice = 'mouse' | 'touchpad';
export type WheelAction =
    { type: 'zoom', factor: number } |
    { type: 'pan', dx: number, dy: number };

type WheelLike = Pick<WheelEvent, 'deltaX' | 'deltaY' | 'deltaMode' | 'ctrlKey' | 'metaKey' | 'shiftKey'>;

// a wheel notch is at least 50px in every browser that reports pixels; a touchpad sends many small, often fractional steps
const MOUSE_MIN_DELTA = 50;
// events closer together than this belong to the same gesture and keep its device
export const GESTURE_GAP_MS = 200;
// pixels per line and per page, for the wheel's non-pixel modes (Firefox)
const LINE_HEIGHT = 20;
const PAGE_HEIGHT = 400;

export function guessWheelDevice(event: WheelLike): WheelDevice {
    if (event.deltaMode !== 0) return 'mouse';
    if (event.deltaX !== 0 && !event.shiftKey) return 'touchpad';
    if (!Number.isInteger(event.deltaX) || !Number.isInteger(event.deltaY)) return 'touchpad';
    return Math.max(Math.abs(event.deltaX), Math.abs(event.deltaY)) >= MOUSE_MIN_DELTA ? 'mouse' : 'touchpad';
}

export function wheelAction(event: WheelLike, device: WheelDevice): WheelAction {
    const pixels = event.deltaMode === 1 ? LINE_HEIGHT : event.deltaMode === 2 ? PAGE_HEIGHT : 1;
    // Chromium sends a pinch as a Ctrl+wheel of -100 * ln(scale), so this follows the fingers
    if ((event.ctrlKey || event.metaKey) && device === 'touchpad') return { type: 'zoom', factor: Math.exp(-event.deltaY / 100) };
    if (device === 'touchpad') return { type: 'pan', dx: -event.deltaX * pixels, dy: -event.deltaY * pixels };
    return { type: 'zoom', factor: Math.pow(2, mouseWheelDelta(event)) };
}

// ReactFlow's own wheel zoom, so that a mouse zooms as fast as before
function mouseWheelDelta(event: WheelLike): number {
    return -event.deltaY * (event.deltaMode === 1 ? 0.05 : event.deltaMode ? 1 : 0.002);
}

export function zoomAround(viewport: Viewport, point: { x: number, y: number }, factor: number, minZoom: number, maxZoom: number): Viewport {
    const zoom = Math.min(maxZoom, Math.max(minZoom, viewport.zoom * factor));
    const scale = zoom / viewport.zoom;
    return { x: point.x - (point.x - viewport.x) * scale, y: point.y - (point.y - viewport.y) * scale, zoom };
}

export function applyWheelAction(viewport: Viewport, action: WheelAction, point: { x: number, y: number }, minZoom: number, maxZoom: number): Viewport {
    if (action.type === 'pan') return { ...viewport, x: viewport.x + action.dx, y: viewport.y + action.dy };
    return zoomAround(viewport, point, action.factor, minZoom, maxZoom);
}
