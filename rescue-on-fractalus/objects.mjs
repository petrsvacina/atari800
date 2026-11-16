/* Ground objects from the supplied disk: typed native geometry, never CPU code. */
const byte = n => n & 255;

export function createObjectContext(options = {}) {
  return {
    half: 0, deathPhase: 0, altitudeHigh: 16, movingObjectMode: 255,
    reflect: 0, groundVisible: 0, anyVisible: 0,
    target: { cost: 128, distance: 128, dx: 128, dy: 128, kind: 0, reflect: 0 },
    span: { maximum: 128, range: 128, side: 128, depth: 128, cell: 0, x: 0, y: 100 },
    shot: { depth: 0, x: 0, y: 0 },
    ...options,
  };
}

function clipPlot(raster, x, y, value) {
  x &= 255; y &= 255;
  const boundary = x < raster.skyline.length ? raster.skyline[x] : 255;
  if (y > boundary && y < 151) raster.plot(x, y, value);
}

/** Original 32×12 inverse-scale bitmap raster ($AB9A).
 * The borrowing subtraction contributes one extra column to the left offset.
 * A step with a zero integer byte becomes exactly 1.0 in the original.
 */
export function paintScaledShape(shape, raster, {
  x, y, step, reflect = false, value = 2
}) {
  step &= 65535;
  if (step < 256) step = 256;
  const left = byte(x - Math.floor(4096 / step) - 1);
  let rowY = y & 255;
  for (let row = 0; row < 3072; row = (row + step) & 65535) {
    let columnX = left;
    for (let column = 0; column < 8192; column = (column + step) & 65535) {
      const sourceX = reflect ? 31 - (column >>> 8) : column >>> 8;
      const bits = shape[(row >>> 8) * 4 + (sourceX >>> 3)];
      if (bits & (128 >>> (sourceX & 7))) clipPlot(raster, columnX, rowY, value);
      columnX = byte(columnX + 1);
    }
    rowY = byte(rowY - 1);
  }
}

function noteTarget(context, x, y, depthHigh, kind) {
  const dx = byte(x - 128), dy = byte(128 - y);
  const distance = (dx & 128 ? byte(-dx) : dx) + (dy & 128 ? byte(-dy) : dy);
  if (distance > 255 || distance + depthHigh > 255 || distance + depthHigh >= context.target.cost) return;
  context.target = {
    cost: distance + depthHigh, distance, dx, dy, kind, reflect: context.reflect
  };
}

function noteSpan(context, index, geometry) {
  const high = geometry.u[index + 1] >>> 8;
  const magnitude = high & 128 ? 255 - high : high;
  const side = byte(((high >>> 1) | (high & 128)) + (high & 1));
  const depthHigh = geometry.depth[index + 1] >>> 8;
  const maximum = byte(depthHigh + magnitude);
  if (depthHigh < magnitude || maximum >= context.span.maximum) return;
  const x = geometry.x[index], y = geometry.y[index];
  context.span = {
    maximum, range: byte(maximum - (magnitude >>> 1)), side, depth: depthHigh,
    cell: geometry.mapIndex[index], x: context.span.x, y: 100,
  };
  if (x < 256 && y < 256) { context.span.x = x; context.span.y = y; }
}

/** Pixel painter for emplacements and downed ships, in the original draw order.
 * Give each legacy-rate terrain pass one shared context. The returned target,
 * span and shot metadata are consumed by the surrounding original rules.
 * Extra presentation frames omit context.random: they never consume gameplay
 * randomness or enqueue a shot. Bitmap output itself does not need randomness.
 */
export class GroundObjectPainter {
  constructor(assets) { this.shapes = assets.shapes; }

  paint(index, geometry, occupants, raster, context = createObjectContext()) {
    const cell = geometry.mapIndex[index], occupant = occupants[cell];
    let step = geometry.depth[index + 1];
    if (!occupant || step < 34) return context;
    const tower = !!(geometry.mapHeight[index] & 128);
    if (!tower && context.half === 0 && occupant >= 2 && occupant < 248)
      noteSpan(context, index, geometry);

    const x = geometry.x[index], y = geometry.y[index];
    if (x >= 256 || y >= 256) return context;
    let shape = tower ? this.shapes.base : this.shapes.ship;
    let markerIndex=index;
    if (occupant >= 250) {
      shape = this.shapes.changed[occupant & 3];
      step >>>= 2;
      // $AB7B changes X. A scaled draw restores the original point index;
      // an occluded/far changed object retains this index for its marker test.
      markerIndex=occupant&3;
    }
    const depthHigh = step >>> 8;
    const boundary = x < raster.skyline.length ? raster.skyline[x] : 255;

    if (tower) {
      if (occupant < 250) {
        if (y < boundary) return context;
        noteTarget(context, x, y, depthHigh, 128);
        clipPlot(raster, x - 1, y, 3);
        if (context.altitudeHigh < 55) {
          context.groundVisible = context.anyVisible = 1;
          if ((context.movingObjectMode & 128) && context.deathPhase === 0 && typeof context.random === 'function') {
            // The random read precedes the existing-queue test in the source.
            const chance = context.random('objects.fire') & 255;
            if ((chance & 128) && context.shot.depth === 0)
              context.shot = { depth: depthHigh, x, y };
          }
        }
      }
      if (depthHigh < 13) paintScaledShape(shape, raster, { x, y, step, value: 3 });
      return context;
    }

    context.reflect = geometry.mapHeight[index] & 1;
    if (y >= boundary) {
      noteTarget(context, x, y, depthHigh, 0);
      if (depthHigh < 13) {
        paintScaledShape(shape, raster, { x, y, step, reflect: !!context.reflect, value: 2 });
        markerIndex=index;
      }
    }
    const marker=occupants[geometry.mapIndex[markerIndex]];
    if (context.half === 0 && context.deathPhase === 0 && marker >= 2 && marker < 248) {
      const markerX=geometry.x[markerIndex],markerY=geometry.y[markerIndex];
      clipPlot(raster, markerX, markerY, 3);
      clipPlot(raster, markerX - 1, markerY - 1, 3);
      clipPlot(raster, markerX - 2, markerY, 3);
      clipPlot(raster, markerX - 1, markerY + 1, 3);
    }
    return context;
  }
}
