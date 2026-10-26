import fs from 'node:fs';import vm from 'node:vm';import zlib from 'node:zlib';import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url),ctx=vm.createContext({Uint8Array,Math});
for(const f of ['hero/assets/original.js','hero/terrain.js','hero/engine.js'])vm.runInContext(fs.readFileSync(new URL(f,root),'utf8'),ctx);
const oracle=JSON.parse(fs.readFileSync(new URL('tools/fixtures/hero-explosions.json',root),'utf8'));oracle.cases=JSON.parse(zlib.inflateSync(Buffer.from(oracle.cases,'base64')));
for(const [index,c]of oracle.cases.entries()){const g=new ctx.Hero.Game({random:()=>0});for(const[k,v]of Object.entries(c.initial))if(k==='score')g.score=v;else g.s[k]=Array.isArray(v)?new Uint8Array(v):v;g.explosions();const out=g.snapshot();for(const k of ['x','y','death','deathSlot','bombs','wallX','wallPhase','extraExplosion','killed','score'])assert.deepEqual(Array.isArray(out[k])?Array.from(out[k]):out[k],c.state[k],`Detonation ${index}: ${k}`);}
console.log(`H.E.R.O.: ${oracle.cases.length} original detonation/score cases agree.`);
