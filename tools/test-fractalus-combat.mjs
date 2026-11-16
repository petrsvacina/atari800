import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {TerrainRaster} from '../rescue-on-fractalus/terrain.mjs';
import {createCombatState, createTerrainContext, applyTerrainEffects, stepEnemyFire, enemyDispatch} from '../rescue-on-fractalus/combat.mjs';

const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/fractalus-combat.json.gz', import.meta.url))));
assert.equal(fixture.sourceSha256, 'e8ff23567b219f614a307a309e42929957facb9b9ff838cc8ff91789eace44ab');
const pick = state => Object.fromEntries([...Object.keys(fixture.fields), 'eventRing', 'terrainScreenSpans'].map(key => [key, state[key]]));
const sites = {
  'combat.fireDelay': 0xA9A4, 'combat.fireLateral': 0xA9F1, 'combat.fireVertical': 0xAA13,
  'combat.fireDirection': 0xAACF, 'combat.impactRoll': 0xAAA5,
  'combat.markAlien': 0xA593, 'combat.spawnColumn': 0xA5CB, 'combat.spawnHeight': 0xA5D3,
  'combat.spawnDriftA': 0xA614, 'combat.spawnDriftB': 0xA617, 'combat.spawnDriftY': 0xA62D
};
let reads = 0;
function replay(c, name) {
  let cursor = 0;
  return {random(site) {
    assert(cursor < c.random.length, `${name}: extra random read ${site}`);
    const [address, value] = c.random[cursor++];
    assert.equal(sites[site], address, `${name}: random read order at ${site}`);
    reads++; return value;
  }, done() { assert.equal(cursor, c.random.length, `${name}: missing random reads`); }};
}
let changed = 0, bolts = 0, impacts = 0;
for (const [index, c] of fixture.fire.entries()) {
  const state = createCombatState(structuredClone(c.before)), raster = new TerrainRaster();
  raster.work = {pixels: 0};
  raster.field.set(Buffer.from(c.field, 'base64'));
  const random = replay(c, `Fire ${index}`);
  const result = stepEnemyFire(state, raster, random.random); random.done();
  assert.deepEqual(pick(state), c.after, `Fire ${index}: complete original named state`);
  assert.deepEqual(Array.from(raster.field), Array.from(Buffer.from(c.afterField, 'base64')), `Fire ${index}: every packed bitmap byte`);
  assert.equal(result.nextIndex ?? c.entryIndex, c.exitIndex, `Fire ${index}: rescue entry index handoff`);
  if (c.field !== c.afterField) changed++;
  if (result.phase === 'bolt') bolts++;
  if (result.phase === 'impact') impacts++;
}
assert(changed > 40 && bolts > 40 && impacts > 40, 'Meaningful visible bolt and impact coverage');
console.log(`PASS ${fixture.fire.length} original enemy-fire states, ${fixture.metrics.bitmapBytes} bitmap bytes, ${changed} changed fields (${bolts} bolts / ${impacts} impacts)`);

let spawns = 0, aging = 0, aliens = 0;
for (const [index, c] of fixture.tail.entries()) {
  const state = createCombatState(structuredClone(c.before));
  const world = {objects: Uint8Array.from(c.objects)};
  const geometry = {spans: Uint8Array.from(c.spans), mapIndex: Uint8Array.from(c.visible)};
  const random = replay(c, `Tail ${index}`);
  const result = applyTerrainEffects(state, world, geometry, structuredClone(c.context),
    {random: random.random, half: c.context.half, skyline: Uint8Array.from(c.skyline)});
  random.done();
  assert.deepEqual(pick(state), c.after, `Tail ${index}: complete original named state`);
  assert.deepEqual(Array.from(world.objects), c.afterObjects, `Tail ${index}: exact alien/map-aging changes`);
  assert.equal(result.nextIndex, c.exitIndex, `Tail ${index}: rescue entry index handoff`);
  if (result.spawned) spawns++;
  if (c.before.mapHitMarker && c.objects.some((v, i) => v > 249 && v !== c.afterObjects[i])) aging++;
  if (c.objects.some((v, i) => v === 1 && c.afterObjects[i] === 128)) aliens++;
}
assert(spawns > 20 && aging > 40 && aliens > 10, 'Meaningful original spawn, map aging and alien conversion coverage');
console.log(`PASS ${fixture.tail.length} original terrain tails: ${spawns} saucer spawns, ${aging} aging passes, ${aliens} unseen-alien conversions`);
for (const c of fixture.dispatch) {
  const expected = c.entries[0] === 0x4F3F ? 'cinematic' : c.entries[0] === 0x7AB8 ? 'alien' : null;
  assert.equal(enemyDispatch({enemyEvent: c.event, alienInside: c.alien}), expected);
}
assert.equal(reads, fixture.metrics.randomReads);
console.log(`PASS ${fixture.dispatch.length} original dispatch priorities and ${reads} ordered original RANDOM reads`);

// Both per-pass reset variants retain precisely the painter metadata which is
// not reset by $A31E, including a pending left-half rescue span.
const original = createCombatState({pitch: 123, depth: 0x2000, objectIndex: 127, drawReflect: 1,
  seenTargetKind: 128, seenTargetReflect: 1, spanMaximum: 42, pilotDistance: 31,
  rescueCell: 17, pilotX: 55, pilotY: 137, fireTargetX: 97, fireTargetY: 122});
const left = createTerrainContext(original, {half: 0}), right = createTerrainContext(original, {half: 48});
assert.equal(left.span.maximum, 128); assert.equal(left.span.range, 128);
assert.equal(right.span.maximum, 42); assert.equal(right.span.range, 31);
for (const context of [left, right]) {
  assert.equal(context.anyVisible, 1); assert.equal(context.groundVisible, 0);
  assert.deepEqual(context.shot, {depth: 0, x: 97, y: 122});
  assert.deepEqual(context.target, {cost: 128, distance: 128, dx: 128, dy: 128, kind: 128, reflect: 1});
  assert.equal(context.span.cell, 17); assert.equal(context.span.x, 55); assert.equal(context.span.y, 137);
}
console.log('PASS original left/right painter-context resets and retained rescue metadata');
