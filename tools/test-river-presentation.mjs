import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import path from 'node:path';import{fileURLToPath}from'node:url';import{gunzipSync}from'node:zlib';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),scope=vm.createContext({});
for(const file of ['assets/original.js','mechanics.js','generator.js','engine.js','raster.js'])vm.runInContext(fs.readFileSync(path.join(root,'river-raid',file),'utf8'),scope);
const reference=JSON.parse(gunzipSync(fs.readFileSync(path.join(root,'tools/fixtures/river-presentation-oracle.json.gz'))));let rows=0,pixels=0;
for(const want of reference.scenes){const g=new scope.RiverRaid.Game();g.gen.flags=want.genFlags;g.gen.nearest=want.nearest;g.gen.first=10;Object.assign(g.gen.actors[10],{flags:want.bridgeFlags,rawY:want.rawY,type:14,frame:want.frame});assert.deepEqual(Array.from(scope.RiverRaster.landColors(g)),want.land,JSON.stringify(want));rows+=160;}
const gauge=scope.RIVER_ASSETS.mechanics.fuelGauge;
for(const want of reference.fuel){const screen=Buffer.from(want.pixels,'base64'),expected=Buffer.from(Array.from({length:gauge.width*gauge.height},(_,i)=>screen[(gauge.y-160+Math.floor(i/gauge.width))*320+gauge.x+i%gauge.width]));assert.deepEqual(Buffer.from(scope.RiverRaster.fuelGauge(scope.RIVER_ASSETS,want.fuel)),expected,'fuel '+want.fuel);pixels+=expected.length;}
console.log(`PASS ${reference.scenes.length} hardware DLI scenes (${rows} scanlines) and ${reference.fuel.length} original fuel amounts (${pixels} gauge pixels).`);
