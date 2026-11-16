import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {FLIGHT_FIELDS} from '../rescue-on-fractalus/flight.mjs';
import {SERVICE_FIELDS,attachFlightServices} from '../rescue-on-fractalus/flight-services.mjs';
import {SYSTEM_FIELDS} from '../rescue-on-fractalus/systems.mjs';
import {RESCUE_FIELDS,createRescueState} from '../rescue-on-fractalus/rescue.mjs';
import {COMBAT_FIELDS} from '../rescue-on-fractalus/combat.mjs';
import {VBI_FIELDS,tickBlinkAndFuel,tickIndicator,tickScanner,stepFlightVbi} from '../rescue-on-fractalus/vbi.mjs';
import {SoundDriver} from '../rescue-on-fractalus/sound.mjs';
import {linkState} from '../rescue-on-fractalus/state.mjs';
import * as spriteApi from '../rescue-on-fractalus/sprites.mjs';
import {prepareCockpit} from '../rescue-on-fractalus/cockpit.mjs';
const json=path=>JSON.parse(fs.readFileSync(new URL(path,import.meta.url)));
const fullPmg=process.argv.includes('--full-pmg');
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL(`fixtures/fractalus-vbi${fullPmg?'-pmg':''}.json.gz`,import.meta.url))));
const soundData=json('../rescue-on-fractalus/assets/sound.json'),rescueData=json('../rescue-on-fractalus/assets/rescue.json');
const tables={...json('../rescue-on-fractalus/assets/systems.json'),energyColors:rescueData.energyColors};
const quarter=json('../rescue-on-fractalus/assets/trigonometry.json').high;
const bootstrap=json('../rescue-on-fractalus/assets/bootstrap.json');
const create=before=>linkState(createRescueState(structuredClone(before)),FLIGHT_FIELDS,SERVICE_FIELDS,SYSTEM_FIELDS,RESCUE_FIELDS,COMBAT_FIELDS,VBI_FIELDS,spriteApi.SPRITE_FIELDS);
const compare=(s,w,keys,label)=>{for(const k of keys)assert.deepEqual(ArrayBuffer.isView(s[k])?[...s[k]]:s[k],w[k],`${label} ${k}`);};
prepareCockpit(json('../rescue-on-fractalus/assets/cockpit.json'));spriteApi.prepareSprites(json('../rescue-on-fractalus/assets/sprites.json'));
const utilityKeys={
  0x4131:['energy','energyEmpty','energyColor','objectPath','fuelFraction','dial','crashTrigger','indicatorPos','indicatorValue','indicatorCharacter','indicatorPhase','thrustCells','energyCells','eventRing','eventHead'],
  0xb70c:['indicatorPos','indicatorValue','indicatorCharacter','indicatorPhase','eventRing','eventHead'],
  0x3ffa:['scannerLeft','scannerRight','rangeCache','killsCache','quotaCache','eventRing','eventHead']
};
const world={terrain:Uint8Array.from(bootstrap.world.terrain),objects:Uint8Array.from(bootstrap.world.objects),visibleCells:Uint8Array.from(bootstrap.world.visibleCells)};
const hooks=attachFlightServices({...world,random:()=>0});
for(const [i,c]of fixture.utilities.entries()) {
  const s=create(c.before);
  if(c.routine===0x4131)tickBlinkAndFuel(s,rescueData.energyColors,hooks);
  else if(c.routine===0xb70c)tickIndicator(s);else tickScanner(s);
  compare(s,c.after,utilityKeys[c.routine],`utility ${i}`);
}
// Observable VBI state: original HUD/PMG scratch is independently tested.
const excluded=new Set(['quotaDim','sensorMaskA','sensorMaskB']);
const keys=[...new Set([...Object.keys(FLIGHT_FIELDS),...Object.keys(SERVICE_FIELDS),...Object.keys(SYSTEM_FIELDS),...Object.keys(VBI_FIELDS),'history','eventRing','horizonCells','thrustCells','energyCells','messageCells','scoreCells','lockCells','score'])].filter(k=>!excluded.has(k));
if(fullPmg)keys.push(...Object.keys(spriteApi.SPRITE_FIELDS));
for(const [i,c]of fixture.cases.entries()) {
  const s=create(c.before.state);let randomAt=0;const random=()=>{assert.ok(randomAt<c.random.length,`VBI ${i}: unexpected RANDOM read`);return c.random[randomAt++];};
  const sound=new SoundDriver(soundData,{random});sound.parameters.set(c.before.sound.parameters);sound.registers.set(c.before.sound.registers);
  for(const [k,v]of Object.entries(c.before.sound))if(!['parameters','registers'].includes(k))sound[k]=v;
  sound.bindFlight(s);
  const worldNow={terrain:Uint8Array.from(bootstrap.world.terrain),objects:Uint8Array.from(bootstrap.world.objects),visibleCells:Uint8Array.from(bootstrap.world.visibleCells)};
  const h=attachFlightServices({...worldNow,random});
  let sprites={player2(){},player3(){},stripe(){}},pm;
  if(fullPmg){pm=spriteApi.createSpriteState();pm.graphicBank.set(Buffer.from(c.before.pmg,'base64'));pm.p3Size=c.before.p3Size;s.energyCells=pm.p1.subarray(0x98,0xd8);sprites=spriteApi.makeSpriteHooks(pm,{spanTable:()=>s.terrainScreenSpans,random});}
  stepFlightVbi(s,{input:c.input,random,sound,hooks:h,world:worldNow,tables,quarter,sprites,lifecycle:{tickCrashFlash(){},setupLevelClear(){throw new Error('Unexpected expiry');}}});
  compare(s,c.after.state,keys,`VBI ${i}`);assert.equal(randomAt,c.random.length,`VBI ${i} RNG count`);
  assert.deepEqual([...sound.registers],c.after.sound.registers,`VBI ${i} POKEY`);
  assert.deepEqual([...sound.parameters],c.after.sound.parameters,`VBI ${i} envelope state`);
  if(fullPmg){assert.deepEqual(pm.graphicBank,Uint8Array.from(Buffer.from(c.after.pmg,'base64')),`VBI ${i} six complete PMG banks`);assert.equal(pm.p3Size,c.after.p3Size,`VBI ${i} SIZEP3`);}
}
console.log(`PASS ${fixture.utilities.length} original utilities + ${fixture.cases.length} coupled flight/ground/sound/score VBI cases; ${fullPmg?'complete PMG/AH/altimeter/scanner, compass and danger glyph writers isolated':'PMG/HUD graphics isolated'}.`);
