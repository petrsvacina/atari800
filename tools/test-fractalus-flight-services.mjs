import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {FLIGHT_FIELDS, integrateFlight} from '../rescue-on-fractalus/flight.mjs';
import {SERVICE_FIELDS, SERVICE_TABLES, THRUST_CELL_ADDRESSES, createServiceState, sampleTerrainHeight, updateGroundProjection, attachFlightServices} from '../rescue-on-fractalus/flight-services.mjs';

const root = new URL('../', import.meta.url);
const reference = JSON.parse(gunzipSync(fs.readFileSync(new URL('tools/fixtures/fractalus-flight-services.json.gz', root))));
assert.deepEqual(reference.layout, {...FLIGHT_FIELDS, ...SERVICE_FIELDS});
assert.deepEqual(reference.serviceTables, SERVICE_TABLES);
assert.deepEqual(reference.thrustAddresses, THRUST_CELL_ADDRESSES);
for (const [map, x, z, expected] of reference.height) assert.equal(sampleTerrainHeight(reference.maps[map], x, z), expected, `sample ${map} at ${x},${z}`);
for (const [i, item] of reference.ground.entries()) {
  const state = createServiceState(structuredClone(item.before));
  updateGroundProjection(state, {terrain: reference.maps[item.map]});
  assert.deepEqual(state, item.after, `complete ground projection ${i}`);
}
function context(item) {
  return {terrain: Uint8Array.from(reference.maps[item.map]), objects: Uint8Array.from(item.objects),
    visibleCells: Uint8Array.from(item.visibleCells), random: () => item.random};
}
for (const [i, item] of reference.services.entries()) {
  const state = createServiceState(structuredClone(item.before)), ctx = context(item);
  attachFlightServices(ctx)[item.name](state, item.argument);
  assert.deepEqual(state, item.after, `${item.name} ${i}`);
  assert.deepEqual(Array.from(ctx.objects), item.objectsAfter, `${item.name} ${i} map`);
}
const tables = JSON.parse(fs.readFileSync(new URL('rescue-on-fractalus/assets/trigonometry.json', root)));
for (const [i, item] of reference.coupled.entries()) {
  const state = createServiceState(structuredClone(item.before)), ctx = context(item);
  integrateFlight(state, {port: item.port, random: ctx.random}, tables.high, attachFlightServices(ctx));
  updateGroundProjection(state, ctx);
  assert.deepEqual(state, item.after, `coupled original flight/ground ${i}`);
  assert.deepEqual(Array.from(ctx.objects), item.objectsAfter, `coupled original map ${i}`);
}
console.log(`PASS ${reference.height.length} original height samples, ${reference.ground.length} ground states, ${reference.services.length} complete service states and ${reference.coupled.length} coupled flight/ground updates without callee isolation.`);
