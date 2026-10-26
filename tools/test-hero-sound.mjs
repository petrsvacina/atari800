import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url),ctx=vm.createContext({Uint8Array});vm.runInContext(fs.readFileSync(new URL('hero/sound-core.js',root),'utf8'),ctx);
const oracle=JSON.parse(fs.readFileSync(new URL('tools/fixtures/hero-sound.json',root),'utf8'));
for(const c of oracle.cases)assert.deepEqual(Array.from(ctx.HeroSound.registers(c.input,c.input.fire,()=>c.input.randomByte)),c.registers,JSON.stringify(c.input));
const wave=new ctx.HeroSound.Wave(48000),out=new Float32Array(48000);wave.set([19,3,30,0xa5]);wave.process(out);assert(out.every(Number.isFinite));assert(out.some(x=>x>.01)&&out.some(x=>x<-.01));
console.log(`H.E.R.O.: ${oracle.cases.length} original audio-control states agree; native waveform is finite and non-silent.`);
