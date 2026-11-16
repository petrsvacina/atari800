import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {word} from '../rescue-on-fractalus/math.mjs';
import {ViewGeometry} from '../rescue-on-fractalus/geometry.mjs';
import {TerrainRaster} from '../rescue-on-fractalus/terrain.mjs';
import {GroundObjectPainter} from '../rescue-on-fractalus/objects.mjs';
import {createCombatState, createTerrainContext, applyTerrainEffects} from '../rescue-on-fractalus/combat.mjs';

const read = file => fs.readFileSync(new URL('../' + file, import.meta.url));
const json = file => JSON.parse(read(file));
const fixture = JSON.parse(gunzipSync(read('tools/fixtures/fractalus-render.json.gz')));
assert.equal(fixture.sourceSha256, 'e8ff23567b219f614a307a309e42929957facb9b9ff838cc8ff91789eace44ab');
const geometryTables = json('rescue-on-fractalus/assets/geometry.json');
const trigTables = json('rescue-on-fractalus/assets/trigonometry.json');
const rasterTables = json('rescue-on-fractalus/assets/raster.json');
const objectTables = json('rescue-on-fractalus/assets/objects.json');
const decode = data => Uint8Array.from(Buffer.from(data, 'base64'));
const snapshot = state => Object.fromEntries([...Object.keys(fixture.fields), 'eventRing', 'terrainScreenSpans'].map(key => [key, state[key]]));
const metadata = context => Object.fromEntries(['reflect', 'groundVisible', 'anyVisible', 'target', 'span', 'shot'].map(key => [key, context[key]]));
const sites = {'objects.fire': 0xA88C, 'combat.markAlien': 0xA593,
  'combat.spawnColumn': 0xA5CB, 'combat.spawnHeight': 0xA5D3,
  'combat.spawnDriftA': 0xA614, 'combat.spawnDriftB': 0xA617, 'combat.spawnDriftY': 0xA62D};
const diagnostics = process.argv.includes('--diagnose');
const fieldDifferences = new Map(), stateDifferences = new Map(), skylineDifferences = new Map(), contextDifferences = new Map();
const featureRows = []; let reads = 0;
function tally(map, key) { map.set(key, (map.get(key) || 0) + 1); }
for (const [number, c] of fixture.cases.entries()) {
  const state = createCombatState(structuredClone(c.before));
  const world = {terrain: Uint8Array.from(c.terrain), objects: Uint8Array.from(c.objects)};
  const geometry = new ViewGeometry(geometryTables, trigTables), raster = new TerrainRaster(geometry, rasterTables);
  geometry.x.set(c.projectedX??Array(45).fill(0x8888));geometry.y.set(c.projectedY??Array(45).fill(0x8888));
  let projected = 0, objectCalls = 0, leaves = 0, segments = 0, scaledCalls = 0;
  const project = geometry.project.bind(geometry); geometry.project = index => { projected++; return project(index); };
  const leaf = raster.leaf.bind(raster); raster.leaf = (...args) => { leaves++; return leaf(...args); };
  const segment = raster.segment.bind(raster); raster.segment = (...args) => { segments++; return segment(...args); };
  const painter = new GroundObjectPainter(objectTables), paint = painter.paint.bind(painter);
  const objectKinds = new Array(8).fill(0);
  painter.paint = (index, g, occupants, targetRaster, context) => {
    objectCalls++;
    const cell = g.mapIndex[index], marker = occupants[cell];
    objectKinds[marker ? marker >= 250 ? 2 + (marker & 3) : g.mapHeight[index] & 128 ? 0 : 1 : 7]++;
    if (marker && g.depth[index+1] >= 34 && g.x[index] < 256 && g.y[index] < 256) scaledCalls++;
    return paint(index, g, occupants, targetRaster, context);
  };
  let fillSky = 0, fillBody = 0, topRows = 0;
  const fill = raster.fill.bind(raster);
  raster.fill = () => {
    for (let column = 3; column < 45; column++) {
      let row = 0; while (row < 48 && raster.field[row*48+column] === 0) row++;
      topRows += row; fillSky += Math.max(0, row-1);
      let pen = 85;
      while (row < 48) {
        const next = rasterTables.chain[raster.field[row*48+column]] & pen;
        fillBody++; if (!next) break; pen = next; row++;
      }
    }
    return fill();
  };
  let cursor = 0;
  const random = site => {
    assert(cursor < c.random.length, `Pass ${number}: extra random read ${site}`);
    const [originalSite, value] = c.random[cursor++];
    assert.equal(sites[site], originalSite, `Pass ${number}: random read at ${site}`); reads++; return value;
  };
  const context = createTerrainContext(state, {half: c.half, random});
  const vector = geometry.headingVector(c.camera.heading);
  state.directionX = word(vector.sin); state.directionZ = word(vector.cos);
  raster.draw(c.camera, world.terrain, {objects: world.objects, painter, context, half: c.half, horizonCells: c.horizonCells});
  const result = applyTerrainEffects(state, world, geometry, context, {random, half: c.half, skyline: raster.skyline});
  state[c.half?'sensorMaskB':'sensorMaskA']=raster.field[23];
  assert.equal(cursor, c.random.length, `Pass ${number}: missing random reads`);
  const actualState = snapshot(state), actualMeta = metadata(context);
  // Shared working registers of the just-finished painter are dead here.
  // Rescue initializes them on entry; the VBI reads neither this scale nor
  // these pixel cursors. Persistent targeting, map and sensor state is checked.
  const scratch=['pilotScale','pilotFractionX','pilotStepX','plotX','plotY','pilotColumnBase','pilotFractionY','fireMask','pilotRowStart'];
  for(const key of scratch){delete actualState[key];}
  const expectedState={...c.after};for(const key of scratch)delete expectedState[key];
  for (const [name, expected] of Object.entries(expectedState))
    if (JSON.stringify(actualState[name]) !== JSON.stringify(expected)) tally(stateDifferences, name);
  for (const [name, expected] of Object.entries(c.metadata))
    if (JSON.stringify(actualMeta[name]) !== JSON.stringify(expected)) tally(contextDifferences, name);
  const expectedField = decode(c.afterField);
  if(diagnostics&&process.argv.includes('--cell-details')) {
    const differences=[];for(let at=48;at<2304;at++)if(raster.field[at]!==expectedField[at])differences.push([Math.floor(at/48),at%48,raster.field[at],expectedField[at]]);
    if(differences.length)console.log(JSON.stringify({number,camera:c.camera,differences}));
  }
  for (let at = 0; at < 2304; at++) if (raster.field[at] !== expectedField[at]) tally(fieldDifferences, `${Math.floor(at/48)},${at%48}`);
  for (let at = 0; at < 256; at++) if (raster.skyline[at] !== c.skyline[at]) tally(skylineDifferences, at);
  if (!diagnostics) {
    assert.deepEqual(actualState, expectedState, `Pass ${number}: persistent coupled state`);
    assert.deepEqual(actualMeta, c.metadata, `Pass ${number}: interleaved painter metadata`);
    assert.deepEqual(raster.field, expectedField, `Pass ${number}: complete packed bitmap`);
    assert.deepEqual(Array.from(raster.skyline), c.skyline, `Pass ${number}: complete skyline`);
  }
  assert.deepEqual(Array.from(world.objects), c.afterObjects, `Pass ${number}: map mutations`);
  assert.equal(result.nextIndex, c.exitIndex, `Pass ${number}: foreground index handoff`);
  assert.deepEqual(c.clock.after, c.clock.before, `Pass ${number}: no hidden VBI in isolated reference`);

  // A second presentation draw uses frozen render inputs and no RNG/effect
  // callback. The live world/state/event ring remain byte-for-byte unchanged.
  const savedState = structuredClone(state), savedObjects = world.objects.slice();
  const smoothGeometry = new ViewGeometry(geometryTables, trigTables);
  smoothGeometry.x.set(c.projectedX??Array(45).fill(0x8888));smoothGeometry.y.set(c.projectedY??Array(45).fill(0x8888));
  const smoothRaster = new TerrainRaster(smoothGeometry, rasterTables);
  const smoothContext = createTerrainContext(createCombatState(structuredClone(c.before)), {half: c.half});
  smoothRaster.draw(c.camera, Uint8Array.from(c.terrain), {objects: Uint8Array.from(c.objects), painter: new GroundObjectPainter(objectTables),
    context: smoothContext, half: c.half, horizonCells: c.horizonCells});
  assert.deepEqual(smoothRaster.field, raster.field, `Pass ${number}: pure redraw pixels`);
  assert.deepEqual(state, savedState); assert.deepEqual(world.objects, savedObjects);
  assert.equal(cursor, c.random.length, 'Presentation redraw must consume zero random bytes');
  const features = {constant: 1, ...raster.work, projected, objectCalls, leaves, segments, scaledCalls,
    fillSky, fillBody, topRows};
  objectKinds.forEach((value, index) => { features[`kind${index}`] = value; });
  featureRows.push({number, half: c.half, cycles: c.cpuCycles, originalWork: c.originalWork, features});
}
console.log(JSON.stringify({passes: fixture.cases.length, randomReads: reads,
  stateDifferences: Object.fromEntries(stateDifferences), contextDifferences: Object.fromEntries(contextDifferences),
  bitmapDifferingCells: fieldDifferences.size, bitmapMostFrequent: Array.from(fieldDifferences).sort((a,b)=>b[1]-a[1]).slice(0,16),
  skylineDifferences: Object.fromEntries(skylineDifferences)}, null, 2));
if (process.argv.includes('--features')) console.log(JSON.stringify({featureRows}));
if (!diagnostics) console.log(`PASS ${fixture.cases.length} coupled original populated render passes, both halves, state, RNG and pure smooth redraws`);
