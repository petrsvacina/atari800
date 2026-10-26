import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import path from 'node:path';import{fileURLToPath}from'node:url';import{createHash}from'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),s=vm.createContext({});
for(const f of ['assets/original.js','generator.js'])vm.runInContext(fs.readFileSync(path.join(root,'river-raid',f),'utf8'),s,{filename:f});
const a=s.RIVER_ASSETS,oracle=JSON.parse(fs.readFileSync(path.join(root,'tools/fixtures/river-generation-oracle.json'))),g=new s.RiverGenerator(a),hash=createHash('sha256');
for(let row=0;row<oracle.rows;row++){
 const pixels=g.next(),b=[...pixels,g.flags,g.segmentRow,g.layout,g.clock,g.flip,g.target,g.velocity&255,g.decorSide,g.decorSeed,g.first,g.nearest,g.blackRows,g.gunnerSlot,g.center,g.water,g.inset,g.hold,g.sections,g.nextWidth,g.stage];
 for(const e of g.actors)b.push(e.rawY,e.frame,e.rawX,e.size,e.flags);b.push(...g.checkpoint.seed,g.checkpoint.center);hash.update(Buffer.from(b));
}
assert.equal(hash.digest('hex'),oracle.normalizedSha256);
console.log(`PASS ${oracle.rows} original river rows, complete slot state and checkpoints (SHA-256)`);
const tankGenerator=new s.RiverGenerator(a),tankCandidates=JSON.parse(fs.readFileSync(path.join(root,'research/river-raid/tank-candidates.json')));let tanks=0;
for(let row=0;row<oracle.rows;row++){tankGenerator.tank.frame=0;tankGenerator.tank.rawY=0;tankGenerator.next();if(tankGenerator.tank.frame){const e=tankCandidates[tanks++];assert.equal(row,e.row);for(const k of ['frame','rawX','rawY','dx','fractionDX','follow'])assert.equal(tankGenerator.tank[k],e[k]);}}
assert.equal(tanks,tankCandidates.length);console.log(`PASS all ${tanks} original road/bank tank births`);
for(let row=0;row<4096;row++)g.next();assert.equal(g.row,oracle.rows+4095);console.log('PASS native generation continues beyond the former map limit');
