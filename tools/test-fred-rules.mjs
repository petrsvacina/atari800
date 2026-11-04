import fs from 'node:fs';
import zlib from 'node:zlib';
import '../fred/assets/data.js';
import {Fred} from '../fred/engine.mjs';
const file=process.argv[2]||new URL('fixtures/fred-rules.json.gz',import.meta.url),raw=fs.readFileSync(file);
const fixture=JSON.parse(String(String(file).endsWith('.gz')?zlib.gunzipSync(raw):raw));
if(fixture.sourceSha256!==FRED_DATA.sourceSha256)throw new Error('Original Fred source SHA mismatch');
let checked=0,failed=0;
const omit=new Set(['transitions']);
for(const test of fixture.cases){
  const game=new Fred(FRED_DATA,test.level,()=>85);
  for(let n=0;n<test.frames.length;n++){
    const f=test.frames[n];game.frame(f.stick,f.fire);const got=game.state();got.sounds=game.events.filter(e=>e.type==='sound').map(e=>e.id);
    const differences=Object.keys(f.state).filter(k=>!omit.has(k)&&JSON.stringify(got[k])!==JSON.stringify(f.state[k]));
    if(differences.length){
      if(failed++<8)console.log(test.name,'frame',n+1,JSON.stringify(Object.fromEntries(differences.map(k=>[k,
        Array.isArray(got[k])&&got[k].length>32?{diff:got[k].flatMap((v,i)=>v!==f.state[k][i]?[[i,v,f.state[k][i]]]:[]).slice(0,15)}:[got[k],f.state[k]]]))));
      break;
    }
    checked++;
  }
}
console.log({checked,failed,sequences:fixture.cases.length});
process.exitCode=failed?1:0;
