import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import '../robbo/assets/data.js';
import { decodeAssets, makeFont, hudCharacters, renderPlayfield, renderFrame } from '../robbo/raster.mjs';

const assets = decodeAssets();
const fixture = JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('./fixtures/robbo-raster.json.gz', import.meta.url))));
assert.equal(fixture.sourceSha256, assets.sourceSha256);
for (const entry of fixture.cases) {
  assert.deepEqual(makeFont(assets, entry.state), Uint8Array.from(Buffer.from(entry.font, 'base64')),
    `FONT differs for ${JSON.stringify(entry.state)}`);
  assert.equal(entry.nogaAfter, entry.state.noga + (entry.state.moving && entry.state.fac ? 1 : 0),
    'CHNMON phase changes after selecting the visible font bank');
}
console.log(`${fixture.cases.length} original XEX wall/animation/direction FONT cases matched all 1024 bytes.`);
for (const entry of fixture.planets) {
  const state = { ...entry.state, map: Uint8Array.from(Buffer.from(entry.state.map, 'base64')) };
  const pixels = renderPlayfield(assets, state, { height: 496 }).pixels;
  const expected = Uint8Array.from(Buffer.from(entry.pixels, 'base64'));
  for (let i = 0; i < pixels.length; i++) assert.equal(pixels[i], expected[i],
    `Planet ${state.level + 1}, pixel ${i % 256},${Math.floor(i / 256)} differs from original ENTCV/PUT_ screen`);
}
console.log(`${fixture.planets.length} complete 256x496 planets matched original ENTCV/PUT_ character-screen pixels.`);

const vbi = JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('./fixtures/robbo-vbi.json.gz', import.meta.url))));
assert.equal(vbi.sourceSha256, assets.sourceSha256);
const positions = [2, 3, 4, 5, 6, 7, 12, 13, 18, 19, 24, 25, 30, 31, 36, 37];
for (const entry of vbi.cases) {
  const native = hudCharacters(assets, entry.state);
  for (const pos of positions) for (const row of [0, 40])
    assert.equal(native[pos + row], entry.expected.hud[pos + row],
      `HUD digit differs in ${entry.name}, character ${pos + row}`);
}
console.log(`${vbi.cases.length} original CVBL HUD number cases matched all 32 digit glyphs.`);

const scanout = JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('./fixtures/robbo-scanout.json.gz', import.meta.url))));
assert.equal(scanout.sourceSha256, assets.sourceSha256);
const state = { ...scanout.state };
for (const field of ['map', 'font', 'infoFont']) state[field] = Uint8Array.from(Buffer.from(state[field], 'base64'));
const pixels = renderFrame(assets, state).pixels;
const expected = Uint8Array.from(Buffer.from(scanout.pixels, 'base64'));
for (let i = 0; i < pixels.length; i++) assert.equal(pixels[i], expected[i],
  `Native PAL scanout differs at ${i % 320},${Math.floor(i / 320)}`);
console.log('One complete 320x240 frozen PAL scanout matched Atari800 pixel for pixel, including DLI/PMG and HUD.');
