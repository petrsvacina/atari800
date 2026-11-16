import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {roundedProduct,signedFraction,makeTrigonometry} from '../rescue-on-fractalus/math.mjs';
const root=new URL('../',import.meta.url);
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('tools/fixtures/fractalus-math.json.gz',root))));
const tables=JSON.parse(fs.readFileSync(new URL('rescue-on-fractalus/assets/trigonometry.json',root)));
assert.equal(fixture.sourceSha256,tables.sourceSha256);
const products=Buffer.from(fixture.products,'base64');
for(let m=0;m<256;m++)for(let n=0;n<256;n++)assert.equal(roundedProduct(m,n),products[(m<<8)|n],`rounded multiply ${m}, ${n}`);
const vector=makeTrigonometry(tables),headings=Buffer.from(fixture.headings,'base64');
for(let heading=0;heading<16384;heading++){
 const actual=vector(heading);
 assert.equal(actual.sin,headings.readInt16LE(heading*4),`sin ${heading}`);
 assert.equal(actual.cos,headings.readInt16LE(heading*4+2),`cos ${heading}`);
}
for(const [factor,value,expected] of fixture.signed)assert.equal(signedFraction(factor,value),expected,`signed fraction ${factor}, ${value}`);
console.log(`PASS 65,536 rounded products, 16,384 complete heading vectors and ${fixture.signed.length} signed products against supplied ATR routines.`);
