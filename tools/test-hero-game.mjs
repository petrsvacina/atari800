import fs from 'node:fs';import vm from 'node:vm';import zlib from 'node:zlib';import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url),ctx=vm.createContext({Uint8Array,Math});
for(const f of ['hero/assets/original.js','hero/assets/timing.js','hero/terrain.js','hero/engine.js','hero/raster.js'])vm.runInContext(fs.readFileSync(new URL(f,root),'utf8'),ctx);
const cases=['hero-game.json','hero-game-extended.json'].flatMap(name=>{const file=JSON.parse(fs.readFileSync(new URL('tools/fixtures/'+name,root),'utf8'));return JSON.parse(zlib.inflateSync(Buffer.from(file.cases,'base64')));});
const feedback=['contact','shotHit','beamWallHit','playerLower','playerMiddle','playerUpper','ghostContact'];
let failures=0,total=0;const byCase=[];
const wanted=new URL(import.meta.url).searchParams.get('cases')?.split(',').map(Number),details=[];
for(const [ci,c] of cases.entries()){
 if(wanted&&!wanted.includes(ci))continue;
 let caseFailures=0,first=null;
 const game=new ctx.Hero.Game({random:()=>0});
 function load(state,onlyFeedback=false){for(const [k,v] of Object.entries(state)){if(onlyFeedback&&!feedback.includes(k)&&k!=='laserPhase')continue;if(k==='score')game.score=v;else if(Array.isArray(v))game.s[k]=new Uint8Array(v);else game.s[k]=v;}}
 load(c.initial);game.preparePose();let previous=c.initial;
 for(const [tick,f] of c.frames.entries()){
  game.step({up:!(f.stick&1),down:!(f.stick&2),left:!(f.stick&4),right:!(f.stick&8),fire:f.fire});
  const actual=game.snapshot(),diff=[];
  for(const [k,v] of Object.entries(actual)){
   if(feedback.includes(k)){if(['contact','shotHit'].includes(k)){if(v.some((x,i)=>(x&128)!==(f.state[k][i]&128)))diff.push([k,v,f.state[k]]);}else if(['ghostContact','beamWallHit'].includes(k)){if((v&128)!==(f.state[k]&128))diff.push([k,v,f.state[k]]);}else if(!!v!==!!f.state[k])diff.push([k,v,f.state[k]]);continue;}
   const expected=f.state[k];if(k==='floorPresent'){if(Boolean(v)!==Boolean(expected))diff.push([k,v,expected]);}
   else if(JSON.stringify(v)!==JSON.stringify(expected))diff.push([k,v,expected]);
  }
  total++;if(diff.length){failures++;caseFailures++;if(!first)first={tick,diff};details.push({case:ci,config:c.config,tick,diff,previous,actual,expected:f.state,picture:game.picture});load(f.state);}
  previous=f.state;
 }
 byCase.push({case:ci,failures:caseFailures,first});
}
if(failures){console.log(JSON.stringify(byCase.filter(c=>c.failures)));fs.writeFileSync('/private/tmp/hero-failures.json',JSON.stringify(details));}
assert.equal(failures,0,`${failures}/${total} source foreground steps differ`);console.log(`H.E.R.O.: ${total} native foreground steps agree with source.`);
