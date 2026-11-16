import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {ViewGeometry} from '../rescue-on-fractalus/geometry.mjs';
import {TerrainRaster} from '../rescue-on-fractalus/terrain.mjs';
const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url));
const geometry=new ViewGeometry(JSON.parse(read('rescue-on-fractalus/assets/geometry.json')),JSON.parse(read('rescue-on-fractalus/assets/trigonometry.json')));
const renderer=new TerrainRaster(geometry,JSON.parse(read('rescue-on-fractalus/assets/raster.json')));
const fixture=JSON.parse(gunzipSync(read('tools/fixtures/fractalus-terrain.json.gz')));
for(const [i,c] of fixture.cases.entries()) {
 renderer.draw(c.camera,Buffer.from(c.map,'base64'));
 assert.deepEqual(Array.from(renderer.skyline.slice(44,212)),c.skyline,`skyline ${i}`);
 const raw=Buffer.from(c.field,'base64'),want=new Uint8Array(160*47);
 for(let y=0;y<47;y++)for(let x=0;x<160;x++)want[y*160+x]=(raw[y*40+(x>>>2)]>>>(6-2*(x&3)))&3;
 const actual=renderer.pixels(),mismatches=[];for(let pixel=0;pixel<want.length;pixel++)if(actual[pixel]!==want[pixel])mismatches.push([pixel%160,Math.floor(pixel/160),actual[pixel],want[pixel]]);assert.equal(mismatches.length,0,`terrain bitmap ${i}: ${JSON.stringify(mismatches.slice(0,12))}`);
 console.log('PASS original terrain view',i,JSON.stringify(renderer.work));
}
console.log(`PASS ${fixture.cases.length} complete original terrain views (${fixture.cases.length*160*47} pixels).`);
