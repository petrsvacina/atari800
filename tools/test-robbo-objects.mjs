import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createObjectEngine} from '../robbo/objects.mjs';
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/robbo-objects.json.gz',import.meta.url))));
assert.equal(fixture.sourceSha256,'75b15bb3c5ee0c76f5d6119ee8dc20ad63494f7e098707887789c305a9a5dbbb');
const cases=fixture.cases;
let failed=0;const groups={};
for(const c of cases){
 const s={...c.state,map:Uint8Array.from(c.map),score:[...c.score]};let reads=0;const sounds=[];
 const ctx={state:s,test:(x=s.x,y=s.y)=>x<0||x>15||y<0||y>30?160:s.map[y*16+x],put:id=>{if(s.x>=0&&s.x<16&&s.y>=0&&s.y<32)s.map[s.y*16+s.x]=id;},randomByte:()=>c.random[reads++%c.random.length],sound:id=>sounds.push(id),robbo:()=>{},addScore:(low,mid)=>{let carry=0;for(let n=2;n>=0;n--){const b=s.score[n],v=(n===2?low:n===1?mid:0),sum=(b>>4)*10+(b&15)+(v>>4)*10+(v&15)+carry;carry=sum>=100?1:0;s.score[n]=((Math.floor(sum%100/10)<<4)|(sum%10));}},teleportExit:()=>{
  let i=s.y*16+s.x+1;while(s.map[i]===32)i++;
  if(s.map[i]===41){s.fac=1;s.map[s.y*16+s.x]=140;sounds.push(14);}
 }};
 const engine=createObjectEngine(ctx);
 if(c.id===-1)engine.tick();else engine.dispatch[c.id]();
 const actual={state:Object.fromEntries(Object.keys(c.state).map(k=>[k,s[k]&255])),map:[...s.map],score:s.score,randomReads:reads,sounds};
 if(JSON.stringify(actual)!==JSON.stringify(c.expected)){
  failed++;groups[c.id]=(groups[c.id]||0)+1;
  if(groups[c.id]===1){
   const diff=Object.keys(actual).filter(k=>JSON.stringify(actual[k])!==JSON.stringify(c.expected[k]));
   console.log(c.name,diff.map(k=>k==='map'?['map',actual.map.flatMap((v,i)=>v!==c.expected.map[i]?[[i,v,c.expected.map[i]]]:[])]:[k,actual[k],c.expected[k]]));
  }
 }
}
assert.equal(failed,0,JSON.stringify(groups));
console.log(`PASS ${fixture.objectCases} supplied-XEX object cases and ${fixture.scanCases} complete map scans: map, state, score, sound and random consumption`);
