import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {ViewGeometry} from '../rescue-on-fractalus/geometry.mjs';
const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url));
const tables=JSON.parse(read('rescue-on-fractalus/assets/geometry.json'));
const trig=JSON.parse(read('rescue-on-fractalus/assets/trigonometry.json'));
const fixture=JSON.parse(gunzipSync(read('tools/fixtures/fractalus-geometry.json.gz')));
let projected=0;
for(const [i,c] of fixture.cases.entries()) {
 const geometry=new ViewGeometry(tables,trig).setup(c.camera,Buffer.from(c.map,'base64'));
 for(const key of ['u','depth','height','mapIndex','mapHeight','visibility','spans']) {
   const actual=Array.from(geometry[key].slice(key==='u'||key==='depth'?1:0));
   assert.deepEqual(actual,c.expected[key],`view ${i} ${key}`);
 }
 for(const [index,x,y] of c.projections){assert.deepEqual(geometry.project(index),[x,y],`view ${i} projected cell ${index}`);projected++;}
}
console.log(`PASS ${fixture.cases.length} original 45-cell view transforms, map traversal, clipping, roll spans and ${projected} projections.`);
