import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sandbox = { atob, Promise, Map, Set };
vm.createContext(sandbox);
new vm.Script(fs.readFileSync(path.join(root, 'web/audio.js'), 'utf8')).runInContext(sandbox);
const Audio = sandbox.DynakillersAudio;
const results = [];
async function test(name, run) { await run(); results.push(name); }
function fixture(reject = false) {
  const elements = new Map(), status = [];
  let effects = 0;
  const audio = new Audio({ samples: { 2: 'eHc=' } }, {
    createAudio: src => {
      const element = { src, currentTime: 0, paused: true, plays: 0, pauses: 0, listeners: {},
        addEventListener(event, handler) { this.listeners[event] = handler; },
        pause() { this.paused = true; this.pauses++; },
        play() { this.plays++; if (reject) return Promise.reject(new Error('gesture required')); this.paused = false; return Promise.resolve(); } };
      elements.set(src.includes('title') ? 'title' : 'ingame', element); return element;
    },
    createContext: () => ({ currentTime: 0, destination: {}, resume: () => Promise.resolve(),
      createGain: () => ({ gain: { value: 0, setTargetAtTime() {} }, connect() {} }),
      createBuffer: (_, n) => ({ getChannelData: () => new Float32Array(n) }),
      createBufferSource: () => ({ connect() {}, start() { effects++; } }),
    }),
    onStatus: message => status.push(message),
  });
  return { audio, elements, status, effects: () => effects };
}
await test('Loading the game never autoplays before a user gesture', () => {
  const { audio, elements } = fixture(); audio.synchronize('menu', false);
  assert.equal(elements.size, 0); assert.equal(audio.requested, null);
});
await test('Title preview uses an offline looping music file', async () => {
  const { audio, elements } = fixture(); audio.togglePreview(); audio.synchronize('menu', false); await Promise.resolve();
  assert.equal(elements.get('title').plays, 1); assert(audio.titlePlaying);
  assert.equal(elements.get('title').loop, true);
  audio.togglePreview(); audio.synchronize('menu', false); assert(elements.get('title').paused);
  assert(fs.existsSync(path.join(root, 'web', elements.get('title').src)));
});
await test('Starting a game switches tracks; another round does not restart the song', async () => {
  const { audio, elements } = fixture(); audio.init(); audio.synchronize('menu', false); await Promise.resolve();
  audio.synchronize('ready', false); await Promise.resolve();
  assert(elements.get('title').paused); assert(!elements.get('ingame').paused);
  elements.get('ingame').currentTime = 38;
  for (const state of ['playing', 'roundOver', 'ready', 'playing']) audio.synchronize(state, false);
  assert.equal(elements.get('ingame').currentTime, 38); assert.equal(elements.get('ingame').plays, 1);
});
await test('Pause and resume preserve the music position', async () => {
  const { audio, elements } = fixture(); audio.init(); audio.synchronize('playing', false); await Promise.resolve();
  elements.get('ingame').currentTime = 57;
  audio.synchronize('playing', true); assert(elements.get('ingame').paused);
  audio.synchronize('playing', false); await Promise.resolve();
  assert.equal(elements.get('ingame').currentTime, 57); assert(!elements.get('ingame').paused);
});
await test('Mute applies to both music and sampled effects', async () => {
  const { audio, elements, effects } = fixture(); audio.init(); audio.synchronize('playing', false, 'both', true); await Promise.resolve();
  assert(elements.get('ingame').muted); audio.play(2); assert.equal(effects(), 0);
  audio.synchronize('playing', false, 'both', false); audio.play(2); assert.equal(effects(), 1);
});
await test('Music-only and samples-only modes select the correct sound sources', async () => {
  const { audio, elements, effects } = fixture(); audio.init(); audio.synchronize('playing', false, 'music'); await Promise.resolve();
  audio.play(2); assert.equal(effects(), 0); assert(!elements.get('ingame').paused);
  audio.synchronize('playing', false, 'samples'); audio.play(2);
  assert(elements.get('ingame').paused); assert.equal(effects(), 1);
});
await test('Autoplay rejection is handled without repeatedly retrying each frame', async () => {
  const { audio, elements, status } = fixture(true); audio.init(); audio.synchronize('menu', false); await Promise.resolve();
  for (let i = 0; i < 50; i++) audio.synchronize('menu', false);
  assert.equal(elements.get('title').plays, 1); assert(status.at(-1).includes('tlačítko'));
  audio.init(); audio.synchronize('menu', false); await Promise.resolve(); assert.equal(elements.get('title').plays, 2);
});
await test('A pending play cannot resume music after the game was paused', async () => {
  const { audio, elements } = fixture(); audio.init(); audio.synchronize('playing', false);
  audio.synchronize('playing', true); await Promise.resolve(); assert(elements.get('ingame').paused);
});
await test('Returning to the menu switches back to the title; leaving the page stops playback', async () => {
  const { audio, elements } = fixture(); audio.init(); audio.synchronize('playing', false); await Promise.resolve();
  audio.synchronize('menu', false); await Promise.resolve();
  assert(elements.get('ingame').paused); assert(audio.titlePlaying);
  audio.stop(); assert(elements.get('title').paused);
});
export const report = { passed: results.length, tests: results };
console.log(JSON.stringify(report, null, 2));
