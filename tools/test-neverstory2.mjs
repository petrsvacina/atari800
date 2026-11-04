import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import {Adventure2} from '../neverending-story-2/engine.mjs';
import {indices2} from '../neverending-story-2/screen.mjs';
vm.runInThisContext(fs.readFileSync(new URL('../neverending-story-2/assets/data.js',import.meta.url),'utf8'));
const data=globalThis.NEVERENDING2_DATA;
const oracle=JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('../research/neverending-story-2/oracle.json.gz',import.meta.url))));
let count=0;
for(const c of oracle.cases) {
  const g=new Adventure2(data,'cs');g.reset(c.part);g.vars=structuredClone(c.variables);g.room=c.room;
  g.pc=g.program.inputs[c.room-1]+1;g.phase='input';g.image=c.part===1?'HEJKAL.MIC':'INGAME.MIC';g.color=c.part===1?220:0;g.events=[];
  const label=JSON.stringify({part:c.part,room:c.room,command:c.command,variables:c.variables});
  g.command(c.command);const vars={...g.vars};delete vars['P$'];
  assert.deepEqual(vars,c.result,label);
  assert.equal(g.phase,c.outcome.phase,label);
  if(g.phase==='input')assert.equal(g.room,c.outcome.room,label);
  const text=events=>events.filter(e=>e[0]==='text').map(e=>e[1]).join('');
  assert.equal(text(g.events.slice(1)),text(c.events),label);
  if(c.image)assert.equal(g.image,c.image,label);
  assert.equal(g.color,c.color,label);count++;
}
console.log('PASS:',count,'original command cases: variables, room, continuation, output, bitmap and palette.');

const route1=[
 ['n','s'],['e','v'],['n','s'],['e','v'],['n','s'],['exa bus','pro kro'],['take ber','seb bob'],
 ['s','j'],['w','z'],['s','j'],['w','z'],['s','j'],['give ber','dej bob'],['take sto','seb kam'],
 ['n','s'],['e','v'],['n','s'],['n','s'],['n','s'],['bra mir','roz zrc'],['take sha','seb ulo'],
 ['s','j'],['s','j'],['e','v'],['n','s'],['e','v'],['brk bra','ulo vet'],['take bra','seb vet'],
 ['w','z'],['s','j'],['w','z'],['n','s'],['n','s'],['w','z'],['use bra','pou vet'],['take cry','seb kry'],
 ['e','v'],['s','j'],['s','j'],['e','v'],['n','s'],['e','v'],['e','v'],['rea wri','cti nap'],['pla cry','hod kry'],['say aur','rek aur'],['s','j'],
];
const route2=[
 ['e','v'],['take tor','seb poc'],['n','s'],['take lim','seb vap'],['pre sto','sti kam'],['s','j'],
 ['e','v'],['bur bus','zap kro'],['n','s'],['e','v'],['e','v'],['give lim','dej vap'],['take sti','seb kla'],
 ['w','z'],['n','s'],['put sti','str kla'],['pul sti','poh kla'],['exa wel','pro stu'],['take key','seb kli'],
 ['s','j'],['w','z'],['s','j'],['w','z'],['s','j'],['use key','pou kli'],['exa che','pro tru'],['take aur','seb aur'],
 ['n','s'],['e','v'],['n','s'],['e','v'],['e','v'],['n','s'],['sho aur','uka aur'],['e','v'],['n','s'],['say nam','rek jme'],
];
for(const language of ['cs','en']) {
  const g=new Adventure2(data,language);g.continue();assert.equal(g.part,1);
  for(const pair of route1){assert.equal(g.phase,'input');g.command(pair[language==='en'?0:1]);}
  assert.equal(g.phase,'pause');assert.equal(g.vars.SKA,1);g.continue();assert.equal(g.part,2);
  for(const pair of route2){assert.equal(g.phase,'input');g.command(pair[language==='en'?0:1]);}
  assert.equal(g.phase,'pause');assert.equal(g.vars.AUR,99);assert.equal(g.vars.DVERE,0);
  g.continue();assert.equal(g.phase,'pause');assert.equal(g.image,'THEEND.MIC');
  assert.match(g.events.filter(e=>e[0]==='text').map(e=>e[1]).join(''),language==='en'?/GAMES OVER/:/KONEC HRY/);
  g.continue();assert.equal(g.part,0);
}
console.log('PASS: complete Czech and English journeys, both parts and ending.');

let switches=0;
for(const language of ['cs','en'])for(const part of [1,2])for(let room=1;room<=12;room++) {
  const g=new Adventure2(data,language);g.reset(part);
  g.pc=g.program.rooms[String(room)];g.advance();assert.equal(g.phase,'input');assert.equal(g.room,room);
  const before=g.snapshot();const other=language==='cs'?'en':'cs';g.setLanguage(other);
  assert.deepEqual(g.vars,before.vars);assert.equal(g.room,room);assert.equal(g.part,part);assert.equal(g.phase,'input');
  g.command('i');assert.equal(g.phase,'input');assert.equal(g.room,room);
  const loaded=new Adventure2(data,other);loaded.restore(before,other);assert.deepEqual(loaded.vars,before.vars);assert.equal(loaded.room,room);
  switches++;
}
console.log('PASS:',switches,'language switches and cross-language save restores without a story turn.');

for(const initialLanguage of ['cs','en']){
  const g=new Adventure2(data,initialLanguage);g.continue();
  for(const [part,route] of [[1,route1],[2,route2]]){
    assert.equal(g.part,part);
    for(const pair of route){
      const state=g.snapshot();g.setLanguage(g.language==='cs'?'en':'cs');assert.deepEqual(g.vars,state.vars);
      if(part===2&&g.room===12){assert.equal(g.image,g.language==='cs'?'INGAME.MIC':'KING.MIC');assert.equal(g.color,g.language==='cs'?0:15);}
      g.command(pair[g.language==='en'?0:1]);
    }
    assert.equal(g.phase,'pause');
    const saved=g.snapshot();g.setLanguage(g.language==='cs'?'en':'cs');assert.deepEqual(g.vars,saved.vars);assert.equal(g.phase,'pause');
    g.continue();
  }
  assert.equal(g.image,'THEEND.MIC');assert.equal(g.phase,'pause');
}
console.log('PASS: both complete journeys while switching languages before every command and at chapter/end prompts.');

const graphics=JSON.parse(fs.readFileSync(new URL('../research/neverending-story-2/graphics.json',import.meta.url),'utf8'));
const initial=new Adventure2(data,'cs');initial.continue();
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
assert.equal(sha(indices2(data,initial).indices),graphics.initialSha256);
for(const c of graphics.cases){initial.language=c.language;initial.image=c.image;initial.color=c.color;assert.equal(sha(indices2(data,initial).indices),c.sha256,JSON.stringify(c));}
console.log('PASS: original initial frame and',graphics.cases.length,'full raster/font/palette frames (64,000 pixels each).');
