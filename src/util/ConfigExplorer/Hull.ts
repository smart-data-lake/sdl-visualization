// Convex hulls around the members of a group in the force layout, and how far two of them overlap.

export interface Point {
    x: number;
    y: number;
}

export interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

/* How far a hull reaches past a member on each side of the screen. */
export interface HullInset {
    side: number;
    top: number;
    bottom: number;
}

const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

/* The convex hull of the points, clockwise on the screen (y down), without collinear points (monotone chain). */
export function convexHull(points: Point[]): Point[] {
    const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y)
        .filter((p, i, all) => i === 0 || p.x !== all[i - 1].x || p.y !== all[i - 1].y);
    if (sorted.length < 3) return sorted;
    const half = (list: Point[]) => {
        const chain: Point[] = [];
        list.forEach(p => {
            while (chain.length >= 2 && cross(chain[chain.length - 2], chain[chain.length - 1], p) <= 0) chain.pop();
            chain.push(p);
        });
        chain.pop();
        return chain;
    };
    return [...half(sorted), ...half([...sorted].reverse())];
}

export function inflate(rect: Rect, inset: HullInset): Rect {
    return {x: rect.x - inset.side, y: rect.y - inset.top, width: rect.width + 2 * inset.side, height: rect.height + inset.top + inset.bottom};
}

export function corners(rect: Rect): Point[] {
    return [{x: rect.x, y: rect.y}, {x: rect.x + rect.width, y: rect.y},
            {x: rect.x + rect.width, y: rect.y + rect.height}, {x: rect.x, y: rect.y + rect.height}];
}

/* The hull around the rectangles, each widened by the inset first. */
export function hullOfRects(rects: Rect[], inset: HullInset): Point[] {
    return convexHull(rects.flatMap(rect => corners(inflate(rect, inset))));
}

export function boundsOf(points: Point[]): Rect {
    const xs = points.map(p => p.x), ys = points.map(p => p.y);
    const x = Math.min(...xs), y = Math.min(...ys);
    return {x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y};
}

export function centroidOf(points: Point[]): Point {
    return {x: points.reduce((sum, p) => sum + p.x, 0) / points.length, y: points.reduce((sum, p) => sum + p.y, 0) / points.length};
}

/*
    The shortest move of `b` that leaves at least `gap` between the two convex polygons, or undefined
    if they are that far apart already (separating axis theorem).
*/
export function separation(a: Point[], b: Point[], gap = 0): Point | undefined {
    let best: {axis: Point, depth: number} | undefined;
    for (const polygon of [a, b]) {
        for (let i = 0; i < polygon.length; i++) {
            const p = polygon[i], q = polygon[(i + 1) % polygon.length];
            const length = Math.hypot(q.x - p.x, q.y - p.y);
            if (length === 0) continue;
            const axis = {x: (q.y - p.y) / length, y: -(q.x - p.x) / length};
            const [minA, maxA] = project(a, axis), [minB, maxB] = project(b, axis);
            const depth = Math.min(maxA, maxB) - Math.max(minA, minB) + gap;
            if (depth <= 0) return undefined;
            if (!best || depth < best.depth) best = {axis, depth};
        }
    }
    if (!best) return undefined;
    // away from a
    const ca = centroidOf(a), cb = centroidOf(b);
    const sign = (cb.x - ca.x) * best.axis.x + (cb.y - ca.y) * best.axis.y >= 0 ? 1 : -1;
    return {x: sign * best.axis.x * best.depth, y: sign * best.axis.y * best.depth};
}

function project(polygon: Point[], axis: Point): [number, number] {
    let min = Infinity, max = -Infinity;
    polygon.forEach(p => {
        const value = p.x * axis.x + p.y * axis.y;
        min = Math.min(min, value);
        max = Math.max(max, value);
    });
    return [min, max];
}

/* The hull as an SVG path relative to `origin`, its corners rounded by `radius`. */
export function roundedPath(points: Point[], origin: Point, radius: number): string {
    if (points.length < 3) return '';
    const local = points.map(p => ({x: p.x - origin.x, y: p.y - origin.y}));
    const along = (from: Point, to: Point, distance: number) => {
        const length = Math.hypot(to.x - from.x, to.y - from.y) || 1;
        const d = Math.min(distance, length / 2);
        return {x: from.x + (to.x - from.x) * d / length, y: from.y + (to.y - from.y) * d / length};
    };
    const segments = local.map((p, i) => {
        const prev = local[(i + local.length - 1) % local.length], next = local[(i + 1) % local.length];
        const start = along(p, prev, radius), end = along(p, next, radius);
        return `${i === 0 ? 'M' : 'L'}${start.x},${start.y} Q${p.x},${p.y} ${end.x},${end.y}`;
    });
    return segments.join(' ') + ' Z';
}
