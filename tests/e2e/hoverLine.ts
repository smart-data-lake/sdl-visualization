import { Locator } from '@playwright/test';

/*
  Hovers an SVG line where it is actually on top. Playwright's hover() aims at the centre of the
  bounding box, which a straight line has none of and a curve may pass under a node at.
*/
export async function hoverLine(line: Locator) {
  const point = await line.evaluate((path: SVGPathElement) => {
    const length = path.getTotalLength(), matrix = path.getScreenCTM()!;
    for (let i = 1; i < 20; i++) {
      const p = path.getPointAtLength(length * i / 20).matrixTransform(matrix);
      if (path.parentElement!.contains(document.elementFromPoint(p.x, p.y))) return {x: p.x, y: p.y};
    }
    return undefined;
  });
  if (!point) throw new Error('the line is covered everywhere');
  await line.page().mouse.move(point.x, point.y);
}
