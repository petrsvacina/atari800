import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const games=JSON.parse(fs.readFileSync(path.join(root,'portal/games.json')));
const corpus=JSON.parse(execFileSync('python3',[path.join(root,'tools/game_i18n_texts.py')],{encoding:'utf8'}));
const czech=/[ěščřžýáíéůúďťňĚŠČŘŽÝÁÍÉŮÚĎŤŇ]/u;
function load(directory,language){const env=vm.createContext({URLSearchParams,location:{search:language==='en'?'?lang=en':''}});vm.runInContext(fs.readFileSync(path.join(root,directory,'i18n.js'),'utf8'),env);return env;}
const environments=new Map(games.map(g=>[g.source,load(g.source,'en')]));
let checks=0;
function translated(directory,source,expected){const t=environments.get(directory).AtariI18n.t,actual=t(source);assert(!czech.test(actual),`${directory}: ${source} -> ${actual}`);assert(!actual.includes('undefined'),actual);if(expected!==undefined)assert.equal(actual,expected);checks++;return actual;}
for(const game of games){
 const cs=load(game.source,'cs').AtariI18n;
 assert.equal(cs.locale,'cs-CZ');assert.equal(environments.get(game.source).AtariI18n.locale,'en-GB');
 new vm.Script(fs.readFileSync(path.join(root,game.source,'game.js'),'utf8'));
 for(const text of corpus[game.source]){assert.equal(cs.t(text),text);translated(game.source,text);}
}
for(const [directory,source,expected]of [
 ['web','KOLO 02 / 08 · ARÉNA 03','ROUND 02 / 08 · ARENA 03'],
 ['web','BOMBY 3 · DOSAH 4','BOMBS 3 · RANGE 4'],
 ['web','POČÍTAČ vyhrává.','COMPUTER wins.'],
 ['web','Rychlé nohy · 12 s','Fast feet · 12 s'],
 ['karate','PÁSEK: ČERNÝ','BELT: BLACK'],
 ['karate','3 VÝHRY','3 WINS'],
 ['karate','1 bodu','1 point'],
 ['karate','Úhyby 8 z 8 · perfektní!','Dodged 8 of 8 · perfect!'],
 ['karate','ÚHYBY 8 Z 8 · PERFEKTNÍ!','DODGED 8 OF 8 · PERFECT!'],
 ['karate','SOUBOJ 02 · HORA FUDŽI','MATCH 02 · MOUNT FUJI'],
 ['archon','Světlo začíná. Vyber figuru.','Light starts. Select a piece.'],
 ['archon','Stín sesílá Uvěznění.','Dark casts Imprison.'],
 ['archon','Čaroděj · vyber cílové pole.','Wizard · choose a destination square.'],
 ['archon','ČARODĚJ · PO ZEMI','WIZARD · GROUND'],
 ['archon','Měňavec → Jednorožec','Shapeshifter → Unicorn'],
 ['archon','Magický bod · Proměnlivé pole · Světlo +3, Stín +4 životů.','Power point · Variable square · Light +3, Dark +4 health.'],
 ['archon','Světlo ovládlo arénu.','Light won the arena battle.'],
 ['goonies-web','Skóre 1,200. Oba kamarádi jsou v bezpečí.','Score 1,200. Both friends are safe.'],
 ['goonies-web','7. Vodopád a chobotnice','7. The waterfall and the octopus'],
 ['river-raid','PILOT 2 / MOST 50 / LETADLA 4','PILOT 2 / BRIDGE 50 / AIRCRAFT 4'],
 ['river-raid','Pilot 2: 3 letadla, 500 bodů. Šipky řídí směr i rychlost.','Pilot 2: 3 aircraft, 500 points. Arrow keys control direction and speed.'],
 ['river-raid','Došlo palivo.','Out of fuel.'],
 ['hero','MISE 17 · 4 ŽIVOTY','MISSION 17 · LIVES 4'],
 ['hero','Zachránil ses až do mise 12. Skóre: 25,000.','You made it to mission 12. Score: 25,000.'],
 ['boulder-dash','JESKYNĚ A · ÚROVEŇ 1 · HRÁČ 2 · 1 ŽIVOT','CAVE A · LEVEL 1 · PLAYER 2 · LIVES 1'],
 ['boulder-dash','JESKYNĚ E · ÚROVEŇ 5 · HRÁČ 1 · 7 ŽIVOTŮ','CAVE E · LEVEL 5 · PLAYER 1 · LIVES 7']
])translated(directory,source,expected);
assert.equal(environments.get('web').AtariI18n.t('  ORIGINAL   ATARI  '),'  ORIGINAL   ATARI  ');
const karate=environments.get('karate');vm.runInContext(fs.readFileSync(path.join(root,'karate/engine.js'),'utf8'),karate);
for(const move of Object.values(karate.KarateEngine.MOVES))translated('karate',move.name);
for(const belt of karate.KarateEngine.BELTS)translated('karate',belt[1]);
const archon=environments.get('archon');vm.runInContext(fs.readFileSync(path.join(root,'archon/engine.js'),'utf8'),archon);
for(const name of archon.ArchonEngine.NAMES)translated('archon',name);
for(const spell of Object.values(archon.ArchonEngine.SPELLS))translated('archon',spell);
const goonies=environments.get('goonies-web');vm.runInContext(fs.readFileSync(path.join(root,'goonies-web/assets/levels.js'),'utf8'),goonies);
for(const level of goonies.GOONIES_LEVELS)for(const key of ['name','intro','objective','hint'])translated('goonies-web',level[key]);
// Cover literal gameplay notices at their original source, not just menu examples.
for(const [directory,filename]of [['archon','engine.js'],['goonies-web','rooms.js'],['goonies-web','engine.js'],['river-raid','engine.js']]){
 const source=fs.readFileSync(path.join(root,directory,filename),'utf8');
 for(const match of source.matchAll(/(?:this\.(?:say|hurt)\(|this\.crash\(|g\.hurt\(|g\.once\('[^']*',|this\.once\('[^']*',)\s*'([^']+)'/g))translated(directory,match[1]);
}
console.log(`PASS ${checks} game localisation checks: seven CZ/EN pages, live counters/results, original moves/spells, eight Goonies guides and source gameplay notices.`);
