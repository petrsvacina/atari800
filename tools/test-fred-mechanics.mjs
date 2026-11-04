import fs from 'node:fs';
import zlib from 'node:zlib';
import '../fred/assets/data.js';
import {Fred} from '../fred/engine.mjs';
const file=process.argv[2]||new URL('fixtures/fred-mechanics.json.gz',import.meta.url),raw=fs.readFileSync(file);
const f=JSON.parse(String(String(file).endsWith('.gz')?zlib.gunzipSync(raw):raw));let failed=0,checked=0;
if(f.sourceSha256!==FRED_DATA.sourceSha256)throw new Error('Original Fred source SHA mismatch');
for(const test of f.cases){
  const game=new Fred(FRED_DATA,test.start.level,()=>test.params.random??85);Object.assign(game,structuredClone(test.start));game.events=[];
  const p=test.params;
  switch(test.action){
    case 'pickup':game.pickup(game.tile(p.col,p.row));break;case 'protection':game.protection(p.mask);break;
    case 'score':game.addScore(p.value);break;case 'pot':game.breakPot(game.tile(p.col,p.row));break;
    case 'fire':game.fire();break;case 'projectile':game.projectile(p.fire,p.mask);break;
    case 'frame':game.frame(p.stick,p.fire,p.collisions);break;case 'actors':game.actors();break;
    case 'transition':{
      game.frame(p.stick,p.fire);const all=[...game.events];
      while(game.stageFrames)all.push(...game.advanceStage(p.stick,p.fire));game.events=all;
    }break;
  }
  const got=game.state();got.sounds=game.events.filter(e=>e.type==='sound').map(e=>e.id);
  const diff=Object.keys(test.state).filter(k=>k!=='transitions'&&JSON.stringify(got[k])!==JSON.stringify(test.state[k]));
  if(diff.length){if(failed++<15)console.log(test.name,Object.fromEntries(diff.map(k=>[k,[got[k],test.state[k]]])));}else checked++;
}
console.log({checked,failed});process.exitCode=failed?1:0;
