import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { renderTitle } from '../robbo/title-raster.mjs';

const data = JSON.parse(fs.readFileSync(new URL('../robbo/assets/title.json', import.meta.url), 'utf8'));
const fixture = JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('./fixtures/robbo-title-raster.json.gz', import.meta.url))));
assert.equal(data.sourceSha256, fixture.sourceSha256);
for (const entry of fixture.cases) {
  const pixels = renderTitle(null, data, entry.logo, entry.typist).pixels;
  const expected = Uint8Array.from(Buffer.from(entry.pixels, 'base64'));
  for (let i = 0; i < pixels.length; i++) assert.equal(pixels[i], expected[i],
    `Title after ${entry.passes} passes differs at ${i % 320},${Math.floor(i / 320)}`);
}
console.log(`${fixture.cases.length} complete original 320x240 title scanouts matched every pixel, including the WLIN palette changes.`);
