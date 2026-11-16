import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {FLIGHT_FIELDS, FLIGHT_HOOKS, createFlightState, integrateFlight, thrustRate} from '../rescue-on-fractalus/flight.mjs';

const root = new URL('../', import.meta.url);
const reference = JSON.parse(gunzipSync(fs.readFileSync(new URL('tools/fixtures/fractalus-flight.json.gz', root))));
const tables = JSON.parse(fs.readFileSync(new URL('rescue-on-fractalus/assets/trigonometry.json', root)));
assert.equal(reference.sourceSha256, tables.sourceSha256);
assert.deepEqual(reference.layout, FLIGHT_FIELDS);
assert.equal(reference.scaleEndpoint, 255);
for (const row of reference.thrust) for (const [notch, rate] of row.rates.entries()) assert.equal(thrustRate(row.level, notch), rate, `level ${row.level} thrust ${notch}`);
for (const [name, address] of Object.entries(FLIGHT_HOOKS)) assert.equal(reference.isolatedCallees[name], address.toString(16).toUpperCase());
let count = 0;
function step(state, frame, label) {
  const trace = [];
  const hooks = Object.fromEntries(Object.keys(FLIGHT_HOOKS).map(name => [name, (_, value) => trace.push(name === 'throttleBar' ? [name, value] : [name])]));
  integrateFlight(state, frame.input, tables.high, hooks);
  for (const name of Object.keys(FLIGHT_FIELDS)) assert.equal(state[name], frame.after[name], `${label}: ${name}`);
  assert.deepEqual(state.history, frame.after.history, `${label}: complete attitude history`);
  assert.deepEqual(state.eventRing, frame.after.eventRing, `${label}: original event ring`);
  assert.deepEqual(trace, frame.hooks, `${label}: isolated subsystem calls`);
  count++;
}
for (const [index, frame] of reference.cases.entries()) step(createFlightState(structuredClone(frame.before)), frame, `case ${index}`);
for (const sequence of reference.sequences) {
  const state = createFlightState(structuredClone(sequence.before));
  for (const [index, frame] of sequence.frames.entries()) step(state, frame, `${sequence.name} step ${index}`);
}
assert.throws(() => integrateFlight(createFlightState({scene: 1}), {}, tables.high), /targetBlip/);
console.log(`PASS ${count} original flight-integration states, ${reference.thrust.length * 9} thrust settings, complete history/event rings and explicit isolated subsystem calls.`);
