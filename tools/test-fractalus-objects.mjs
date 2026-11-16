import assert from 'node:assert/strict';
import fs from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { GroundObjectPainter, createObjectContext, paintScaledShape } from '../rescue-on-fractalus/objects.mjs';
import { TerrainRaster } from '../rescue-on-fractalus/terrain.mjs';

const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/fractalus-objects.json.gz', import.meta.url))));
const assets = JSON.parse(fs.readFileSync(new URL('../rescue-on-fractalus/assets/objects.json', import.meta.url)));
assert.equal(fixture.sourceSha256, 'e8ff23567b219f614a307a309e42929957facb9b9ff838cc8ff91789eace44ab');
assert.equal(assets.sourceSha256, fixture.sourceSha256);
const decode = data => Uint8Array.from(Buffer.from(data, 'base64'));
function rasterFor(c) {
  const raster = new TerrainRaster(null, null);
  raster.field.set(decode(c.field)); raster.skyline = decode(c.skyline); raster.work = { pixels: 0 };
  return raster;
}
function geometryFor(c) {
  const geometry = { x: new Uint16Array(45), y: new Uint16Array(45), depth: new Uint16Array(46),
    u: new Uint16Array(46), mapIndex: new Uint8Array(45), mapHeight: new Uint8Array(45) };
  geometry.x[c.index] = c.x; geometry.y[c.index] = c.y;
  geometry.depth[c.index + 1] = c.depth; geometry.u[c.index + 1] = c.relativeX;
  geometry.mapIndex[c.index] = c.mapIndex; geometry.mapHeight[c.index] = c.mapHeight;
  return geometry;
}
function resultMetadata(context) {
  return Object.fromEntries(['reflect', 'groundVisible', 'anyVisible', 'target', 'span', 'shot']
    .map(name => [name, context[name]]));
}

for (const [index, c] of fixture.scaled.entries()) {
  const shape = c.form.startsWith('changed') ? assets.shapes.changed[Number(c.form.slice(7))] : assets.shapes[c.form];
  const raster = rasterFor(c);
  paintScaledShape(shape, raster, c);
  assert.deepEqual(raster.field, decode(c.after), `scaled bitmap ${index} (${c.form}, step ${c.step}, reflect ${c.reflect})`);
  assert.deepEqual(raster.skyline, decode(c.skyline), `scaled bitmap ${index}: occlusion remains unchanged`);
}
console.log(`PASS ${fixture.scaled.length} original scaled bitmaps: six shapes, zero/fractional scale, reflection, clipping, occlusion and OR blending`);

const painter = new GroundObjectPainter(assets);
let randomReads = 0;
for (const [index, c] of fixture.dispatch.entries()) {
  const raster = rasterFor(c), geometry = geometryFor(c), occupants = new Uint8Array(256);
  occupants[c.mapIndex] = c.occupant;
  let read = 0;
  const context = createObjectContext(structuredClone(c.context));
  context.random = site => {
    assert.equal(site, 'objects.fire');
    assert(read < c.random.length, `object ${index}: unexpected chance read`);
    const [originalSite, value] = c.random[read++];
    assert.equal(originalSite, 0xA88C);
    return value;
  };
  painter.paint(c.index, geometry, occupants, raster, context);
  assert.deepEqual(raster.field, decode(c.after), `ground object ${index}: bitmap`);
  assert.deepEqual(resultMetadata(context), c.metadata, `ground object ${index}: target/span/queue`);
  assert.equal(read, c.random.length, `ground object ${index}: original random read order`);
  randomReads += read;

  // Extra display frames draw the same pixels with no gameplay RNG callback.
  const pureRaster = rasterFor(c), pureContext = createObjectContext(structuredClone(c.context));
  painter.paint(c.index, geometryFor(c), occupants, pureRaster, pureContext);
  assert.deepEqual(pureRaster.field, raster.field, `ground object ${index}: pure presentation pixels`);
}
console.log(`PASS ${fixture.dispatch.length} original ground-object dispatches, including all six transition values, draw halves and targeting/shot metadata`);
console.log(`PASS ${randomReads} original chance reads; presentation-only redraws consume no gameplay random bytes`);
console.log(`PASS ${(fixture.scaled.length + fixture.dispatch.length) * 48 * 48} compared original bitmap bytes`);
