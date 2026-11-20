import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import '../robbo/assets/data.js';
import { decodeAssets, renderFrame, renderHud } from '../robbo/raster.mjs';

const assets = decodeAssets();
assert.equal(assets.demoText.length, 40);
const fixture = JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('./fixtures/robbo-demo-raster.json.gz', import.meta.url))));
assert.equal(fixture.sourceSha256, assets.sourceSha256);
for (const entry of fixture.cases) {
  const state = { ...entry.state };
  for (const key of ['map', 'font', 'infoFont']) state[key] = Uint8Array.from(Buffer.from(state[key], 'base64'));
  assert.equal(renderHud(assets, state).height, 24);
  const pixels = renderFrame(assets, state).pixels;
  const expected = Uint8Array.from(Buffer.from(entry.pixels, 'base64'));
  for (let i = 0; i < pixels.length; i++) assert.equal(pixels[i], expected[i],
    `Demo RTCLOK=${state.clock} differs at ${i % 320},${Math.floor(i / 320)}`);
}
console.log(`${fixture.cases.length} native PAL demo scanouts matched all 320x240 pixels, including the third HUD row and RTCLOK luminance.`);
