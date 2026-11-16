/* Native world creation from the supplied disk's $6FBF/$70B3/$7498 routines.
 * The injected byte source stands in for POKEY RANDOM. No original CPU code runs here.
 */
export const WORLD_SIDE = 16;
export const WORLD_CELLS = 256;

const NEIGHBORS = [[1, 16], [-1, -16], [16, -1], [-16, 1]];
const RANDOM_DIRECTIONS = [[1, 16], [16, -1], [-1, -16], [-16, 1]];

function bytes(value, name) {
  if (!(value instanceof Uint8Array) || value.length !== WORLD_CELLS)
    throw new TypeError(`${name} must contain 256 bytes`);
  return value;
}

function stageNumber(value) {
  if (!Number.isInteger(value) || value < 0 || value > 255)
    throw new RangeError('level must be an integer from 0 to 255');
  return value;
}

function readByte(random, site) {
  if (typeof random !== 'function') throw new TypeError('A random-byte callback is required');
  return random(site) & 255;
}

// A corridor can be carved only while the wall, cell two steps away and side
// neighbor are all still marked. Row-edge arithmetic wraps over the whole byte.
function canCarve(terrain, position, step, side) {
  const wall = (position + step) & 255;
  return !!((terrain[wall] & 128) &&
    (terrain[(wall + step) & 255] & 128) &&
    (terrain[(wall + side) & 255] & 128));
}

/** Build the original 16×16 height/peak field ($6FBF).
 * Values retain their original high-bit peak markers. The original stack stores
 * the current cell once for EACH possible direction; replacing it with a usual
 * maze DFS changes the resulting world and the order of random reads.
 */
export function carveTerrain(random, terrain = new Uint8Array(WORLD_CELLS)) {
  bytes(terrain, 'terrain');
  for (let cell = 0; cell < WORLD_CELLS; cell++)
    terrain[cell] = (readByte(random, 'terrain.height') & 63) | 128;

  let position = readByte(random, 'terrain.start');
  terrain[position] = readByte(random, 'terrain.startHeight') & 63;
  const stack = new Uint8Array(WORLD_CELLS);
  let depth = 1;

  for (;;) {
    const previousDepth = depth;
    for (const [step, side] of NEIGHBORS) {
      if (canCarve(terrain, position, step, side)) {
        stack[depth] = position;
        depth = (depth + 1) & 255;
      }
    }
    if (depth === previousDepth) {
      depth = (depth - 1) & 255;
      if (depth === 0) return terrain;
      position = stack[depth];
      continue;
    }

    let step, side;
    do {
      [step, side] = RANDOM_DIRECTIONS[readByte(random, 'terrain.direction') >>> 6];
    } while (!canCarve(terrain, position, step, side));
    const wall = (position + step) & 255;
    terrain[wall] = readByte(random, 'terrain.wallHeight') & 63;
    position = (wall + step) & 255;
    terrain[position] = readByte(random, 'terrain.nextHeight') & 63;
  }
}

/** Original optional peak removal ($70B3). Mutates the supplied terrain. */
export function unmarkTerrain(terrain, { level = 1, random } = {}) {
  bytes(terrain, 'terrain'); stageNumber(level);
  // At level 1 the original DEY/BEQ bypasses this random read altogether.
  if (level !== 1 && (readByte(random, 'unmark.gate') & 7)) return false;
  const threshold = (readByte(random, 'unmark.threshold') & 112) | 128;
  for (let cell = 0; cell < WORLD_CELLS; cell++) {
    if (!(cell & 136) && readByte(random, 'unmark.cell') < threshold)
      terrain[cell] &= 127;
  }
  return true;
}

/** Emplacement probability byte derived by the original level setup ($7620). */
export function emplacementDensity(level) {
  stageNumber(level);
  return level === 1 ? 0 : Math.min(level, 43) * 4;
}

/** Place original occupants with the stride-$43 search ($4E1C).
 * visibleCells contains the 45 map indices in the current projection ($2276).
 * A full scan that finds no eligible cell consumes one random byte and continues
 * to the next requested occupant, as in the original.
 */
export function placeOccupants(terrain, objects, {
  random, value = 200, count = 1, visibleCells = new Uint8Array(45)
} = {}) {
  bytes(terrain, 'terrain'); bytes(objects, 'objects');
  if (!Number.isInteger(count) || count < 1 || count > 256)
    throw new RangeError('count must be an integer from 1 to 256');
  const visible = new Set(visibleCells);
  let placed = 0;
  for (let attempt = 0; attempt < count; attempt++) {
    const start = readByte(random, 'objects.start');
    let cell = start;
    do {
      if (terrain[cell] < 48 && objects[cell] === 0 && !visible.has(cell)) {
        objects[cell] = value;
        placed++;
        break;
      }
      cell = (cell + 67) & 255;
    } while (cell !== start);
  }
  return placed;
}

/** Original fresh-world occupants and marked-peak emplacements ($7498). */
export function seedObjects(terrain, {
  level = 1, random, density = emplacementDensity(level),
  visibleCells = new Uint8Array(45), objects = new Uint8Array(WORLD_CELLS)
} = {}) {
  bytes(terrain, 'terrain'); bytes(objects, 'objects'); stageNumber(level);
  objects.fill(0);
  placeOccupants(terrain, objects, {
    random, value: 200, count: level === 1 ? 16 : 8, visibleCells
  });
  if (level >= 4)
    placeOccupants(terrain, objects, { random, value: 1, count: 4, visibleCells });

  // The probability byte is read for EVERY map index, even at zero density and
  // on unmarked cells. Move the read behind either test and future RNG changes.
  let cell = 0;
  do {
    if (readByte(random, 'objects.emplacement') < (density & 255) && (terrain[cell] & 128))
      objects[cell] = 100;
    cell = (cell + 67) & 255;
  } while (cell !== 0);
  return objects;
}

/** Run the three original fresh-world stages with one continuous byte source.
 * Later mission reuse/regeneration is decided by the game's surrounding state
 * machine, not here. Additional display frames must not call this function.
 */
export function generateWorld({
  level = 1, random, density = emplacementDensity(level), visibleCells = new Uint8Array(45)
} = {}) {
  stageNumber(level);
  const terrain = carveTerrain(random);
  unmarkTerrain(terrain, { level, random });
  const objects = seedObjects(terrain, { level, random, density, visibleCells });
  return { terrain, objects };
}
