import assert from 'node:assert/strict';
import fs from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import {
  carveTerrain, unmarkTerrain, seedObjects, placeOccupants,
  emplacementDensity, generateWorld
} from '../rescue-on-fractalus/world.mjs';

const fixture = JSON.parse(gunzipSync(fs.readFileSync(fileURLToPath(
  new URL('./fixtures/fractalus-world.json.gz', import.meta.url)
))));
assert.equal(fixture.sourceSha256, 'e8ff23567b219f614a307a309e42929957facb9b9ff838cc8ff91789eace44ab');
const decode = text => Uint8Array.from(Buffer.from(text, 'base64'));

// These addresses occur only in this offline oracle test. The runtime uses
// descriptive callback sites and ordinary algorithms, with no program counter.
const names = new Map([
  [0x6FC3, 'terrain.height'], [0x6FD5, 'terrain.start'], [0x6FDB, 'terrain.startHeight'],
  [0x6FF0, 'terrain.direction'], [0x701E, 'terrain.wallHeight'], [0x702B, 'terrain.nextHeight'],
  [0x70B8, 'unmark.gate'], [0x70BF, 'unmark.threshold'], [0x70D4, 'unmark.cell'],
  [0x4E22, 'objects.start'], [0x74BD, 'objects.emplacement']
]);

function replay(rows, label) {
  let index = 0;
  function random(site) {
    assert(index < rows.length, `${label}: unexpected random read ${site}`);
    const [address, value] = rows[index];
    assert.equal(site, names.get(address), `${label}: random read ${index}`);
    index++;
    return value;
  }
  random.count = () => index;
  return random;
}

let worldBytes = 0, randomReads = 0;
const unmarkBranches = new Set();
for (const [index, c] of fixture.pipelineCases.entries()) {
  const label = `world ${index}, level ${c.level}`;
  assert.equal(emplacementDensity(c.level), c.density, `${label}: original level density`);
  const random = replay(c.random, label);
  const terrain = decode(c.terrainBefore), objects = decode(c.objectsBefore);
  assert.equal(carveTerrain(random, terrain), terrain);
  assert.deepEqual(terrain, decode(c.stages[0].terrain), `${label}: carved heights/peaks`);
  assert.equal(random.count(), c.stages[0].randomReads, `${label}: carving read count`);
  const unmarked = unmarkTerrain(terrain, { level: c.level, random });
  const unmarkReads = c.stages[1].randomReads - c.stages[0].randomReads;
  unmarkBranches.add(`${c.level === 1 ? 'level1' : 'later'}:${unmarked}`);
  assert.equal(unmarked, unmarkReads > 1, `${label}: optional sweep branch`);
  assert.deepEqual(terrain, decode(c.stages[1].terrain), `${label}: optional peak removal`);
  assert.equal(random.count(), c.stages[1].randomReads, `${label}: peak removal read count`);
  assert.equal(seedObjects(terrain, {
    level: c.level, random, density: c.density, visibleCells: c.visibleCells, objects
  }), objects);
  assert.deepEqual(terrain, decode(c.stages[2].terrain), `${label}: final heights unchanged`);
  assert.deepEqual(objects, decode(c.stages[2].objects), `${label}: pilots/occupants/emplacements`);
  assert.equal(random.count(), c.random.length, `${label}: complete ordered byte stream`);

  // The public combined entry must have exactly the same state and consumption
  // as independently stepping the three original stages.
  const combinedRandom = replay(c.random, label + ' combined');
  const combined = generateWorld({
    level: c.level, random: combinedRandom, visibleCells: c.visibleCells
  });
  assert.deepEqual(combined.terrain, terrain, `${label}: combined terrain`);
  assert.deepEqual(combined.objects, objects, `${label}: combined objects`);
  assert.equal(combinedRandom.count(), c.random.length);

  for (let cell = 0; cell < 256; cell++) {
    if (objects[cell] === 200 || objects[cell] === 1) {
      assert(terrain[cell] < 48, `${label}: occupant on high terrain`);
      assert(!c.visibleCells.includes(cell), `${label}: occupant in excluded visible cell`);
    }
    if (objects[cell] === 100) assert(terrain[cell] & 128, `${label}: emplacement on unmarked terrain`);
  }
  worldBytes += 4 * 256; // carved terrain, unmarked terrain, final terrain + object map
  randomReads += c.random.length;
}
assert.deepEqual([...unmarkBranches].sort(), ['later:false', 'later:true', 'level1:true']);
console.log(`PASS ${fixture.pipelineCases.length} original fresh-world pipelines: all terrain, peaks, occupants and level density`);

for (const c of fixture.placementCases) {
  const random = replay(c.random, c.name);
  const terrain = decode(c.terrain), before = decode(c.objectsBefore), objects = before.slice();
  const placed = placeOccupants(terrain, objects, {
    random, value: c.value, count: c.count, visibleCells: c.visibleCells
  });
  assert.deepEqual(objects, decode(c.objectsAfter), c.name);
  assert.deepEqual(terrain, decode(c.terrain), `${c.name}: search must preserve terrain`);
  assert.equal(random.count(), c.random.length, c.name);
  assert.equal(placed, objects.reduce((n, value, cell) => n + Number(value !== before[cell]), 0));
  worldBytes += 2 * 256;
  randomReads += c.random.length;
}
assert.equal(randomReads, fixture.metrics.orderedRandomReads);
console.log(`PASS ${fixture.placementCases.length} original targeted placement cases, including full scans and original count-byte wrap`);
console.log(`PASS ${randomReads} ordered original RANDOM reads (site + byte) and ${worldBytes} map bytes; native runtime has no CPU`);
