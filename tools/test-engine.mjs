import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sandbox = { Math, Set, Map };
vm.createContext(sandbox);
for (const file of ['web/assets/original-data.js', 'web/engine.js']) {
  new vm.Script(fs.readFileSync(path.join(root, file), 'utf8'), { filename: file }).runInContext(sandbox);
}
const { Game } = sandbox.DynakillersEngine;
const assets = sandbox.DYNA_ASSETS;
let seed = 12345;
const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
const make = (options = {}) => {
  const game = new Game(assets, { bot: false, random, ...options }); game.start();
  game.state = 'playing'; game.terrain.fill(0); return game;
};
const results = [];
function test(name, run) { run(); results.push(name); }

test('All eight original maps have 240 cells, three-player spawns and safe exits', () => {
  assert.equal(assets.maps.length, 8);
  for (let arena = 0; arena < 8; arena++) {
    assert.equal(assets.maps[arena].length, 240);
    const game = new Game(assets, { players: 3, arena, random }); game.start();
    assert.equal(game.players[1].x, 312); assert.equal(game.players[1].y, 8);
    assert.equal(game.players[2].x, 312); assert.equal(game.players[2].y, 184);
    for (const p of game.players) assert.equal(game.terrain[game.cell(p.x, p.y)], 0);
    for (const cell of [0, 1, 20, 18, 19, 39, 200, 220, 221, 219, 238, 239]) assert.equal(game.terrain[cell], 0);
  }
});
test('Bomb capacity, leaving a newly placed bomb and blocking re-entry', () => {
  const g = make(), p = g.players[0];
  assert(g.placeBomb(p)); assert(!g.placeBomb(p));
  for (let i = 0; i < 25; i++) g.step([{ right: true }]);
  assert(p.x > 25);
  const bomb = g.bombs[0]; assert(!bomb.pass.has(p.id));
  assert(g.blocked(p, 8, 8));
});
test('A bomb ignites after 130 PAL ticks, then burns for 20 ticks', () => {
  const g = make(), p = g.players[0]; g.placeBomb(p); p.x = 100; p.y = 100;
  for (let i = 0; i < 129; i++) g.step();
  assert.equal(g.flames.length, 0); g.step();
  assert.equal(g.bombs.length, 0); assert.equal(g.flames.length, 1);
  for (let i = 0; i < 20; i++) g.step();
  assert.equal(g.flames.length, 0);
});
test('Walls block blasts; the first rock stops the ray and is destroyed', () => {
  const g = make(), cell = 105;
  g.terrain[104] = 1; g.terrain[107] = 2;
  const b = { cell, owner: 0, power: 6, fuse: 0, pass: new Set() }; g.bombs.push(b);
  const cells = g.blastCells(b);
  assert(!cells.includes(104)); assert(!cells.includes(103));
  assert(cells.includes(107)); assert(!cells.includes(108));
  g.explode(b); assert.equal(g.terrain[104], 1); assert.equal(g.terrain[107], 0);
});
test('A blast triggers a neighboring bomb and its own rays', () => {
  const g = make();
  for (const cell of [105, 107]) g.bombs.push({ cell, owner: 0, power: 4, fuse: 100, pass: new Set() });
  g.explode(g.bombs[0]); assert.equal(g.bombs.length, 0); assert.equal(g.flames.length, 2);
  assert(g.flames.some(f => f.cells.includes(110)));
});
test('Simultaneous deaths are a draw and cannot award a phantom winner', () => {
  const g = make({ rounds: 1 }); g.players[1].x = g.players[0].x;
  g.flames.push({ cells: [0], until: 10 }); g.step();
  assert(g.players.every(p => !p.alive));
  for (let i = 0; i < 40; i++) g.step();
  assert.equal(g.state, 'matchOver'); assert.equal(g.winner, null);
  assert.equal(g.scores.reduce((a, b) => a + b, 0), 0);
});
test('Bonuses obey original caps and Stop cancels a temporary effect', () => {
  const g = make(), p = g.players[0]; p.bombs = 10; p.power = 19;
  g.terrain[0] = 5; g.collect(p); assert.equal(p.bombs, 10);
  g.terrain[0] = 6; g.collect(p); assert.equal(p.power, 19);
  p.effect = 6; p.effectUntil = 100; assert(!g.placeBomb(p));
  g.terrain[0] = 4; g.collect(p); assert.equal(p.effect, null); assert(g.placeBomb(p));
  p.effect = 0; p.effectUntil = g.tick + 1; g.step(); assert.equal(p.effect, null);
});
test('A round awards exactly one point and rotates through original arenas', () => {
  const g = make({ rounds: 2, arena: 7 }); g.players[1].alive = false;
  for (let i = 0; i < 100; i++) g.step();
  assert.equal(g.state, 'roundOver'); assert.equal(g.scores[0], 1);
  g.nextRound(); assert.equal(g.arena, 0); assert.equal(g.round, 2); assert.equal(g.scores[0], 1);
});
test('Player cannot cross terrain or leave the field during sustained input', () => {
  const g = make(), p = g.players[0]; g.terrain[1] = 1;
  for (let i = 0; i < 80; i++) g.step([{ right: true, up: true }]);
  assert(p.x < 16); assert(p.y >= 5.8);
});
test('AI plans an escape before dropping a bomb near a rock', () => {
  const g = make({ bot: true }), p = g.players[1]; p.x = 168; p.y = 88;
  g.terrain[5 * 20 + 11] = 2; g.tick = 16;
  g.botInput(p); assert.equal(g.bombs.length, 1); assert(p.botPlan.length > 0);
  for (let i = 0; i < 150 && g.state === 'playing'; i++) g.step();
  assert(p.alive, 'AI should escape its own first bomb in an open arena');
});
test('Long simulations preserve finite positions, map bounds and bomb limits', () => {
  for (let arena = 0; arena < 8; arena++) {
    const g = new Game(assets, { bot: true, players: 3, arena, random }); g.start();
    for (let tick = 0; tick < 3000; tick++) {
      g.step([{ right: tick % 400 < 100, down: tick % 400 >= 100 && tick % 400 < 200, left: tick % 400 >= 200 && tick % 400 < 300, up: tick % 400 >= 300, bomb: tick % 80 === 0 }]);
      assert(g.bombs.length <= 30);
      for (const p of g.players) assert(Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.x <= 320 && p.y >= 0 && p.y <= 192);
      if (g.state === 'roundOver') g.nextRound();
    }
  }
});
export const report = { passed: results.length, tests: results };
console.log(JSON.stringify(report, null, 2));
