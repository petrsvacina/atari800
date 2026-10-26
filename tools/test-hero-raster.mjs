import fs from 'node:fs';import vm from 'node:vm';import zlib from 'node:zlib';import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url),ctx=vm.createContext({Uint8Array,Math});
for(const f of ['hero/assets/original.js','hero/terrain.js','hero/engine.js','hero/raster.js'])vm.runInContext(fs.readFileSync(new URL(f,root),'utf8'),ctx);
const c=JSON.parse(fs.readFileSync(new URL('tools/fixtures/hero-raster.json',root),'utf8')),game=new ctx.Hero.Game({random:()=>0});
for(const[k,v]of Object.entries(c.state))if(k==='score')game.score=v;else game.s[k]=Array.isArray(v)?new Uint8Array(v):v;
game.body={...c.body,bits:c.body.sheet==='actor'?game.assets.actorBits:game.assets.heroBits};game.preparePose();
const raw=ctx.HeroRaster.indexed(game),crop=Buffer.alloc(336*240);for(let y=0;y<240;y++)crop.set(raw.subarray(y*384+24,y*384+360),y*336);
assert.deepEqual(crop,zlib.inflateSync(Buffer.from(c.pixels,'base64')));console.log('H.E.R.O.: all 80,640 indexed pixels agree with original raster, including HUD and logo.');
