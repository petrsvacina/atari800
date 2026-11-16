import {tickCrashFlash,fadeFatalPalette,resetAfterDeath,prepareLaunch,countLevels,setupLevelClear,
 jaggiDeathTail,crashDeath,missionReturn,LifecycleController} from '../rescue-on-fractalus/lifecycle.mjs';
import {SoundDriver,JingleDriver} from '../rescue-on-fractalus/sound.mjs';
const read=async path=>JSON.parse(await Deno.readTextFile(new URL(path,import.meta.url)));
const data=await read('../rescue-on-fractalus/assets/lifecycle.json'),soundData=await read('../rescue-on-fractalus/assets/sound.json'),systemsData=await read('../rescue-on-fractalus/assets/systems.json');
const compressed=await Deno.readFile(new URL('./fixtures/fractalus-lifecycle.json.gz',import.meta.url));
const f=await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))).json();
function eq(a,b,label){if(JSON.stringify(a)!==JSON.stringify(b)){if(Array.isArray(a)){const i=a.findIndex((v,i)=>JSON.stringify(v)!==JSON.stringify(b[i]));throw new Error(`${label}[${i}]: ${JSON.stringify(a[i])} != ${JSON.stringify(b[i])}`);}throw new Error(`${label}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`);}}
let count=0;
for(const [kind,cases] of Object.entries(f.cases))for(const c of cases) {
 const s=structuredClone(c.before);let at=c.randomOffset;
 if(kind==='flash')tickCrashFlash(s,{random:()=>f.randoms[at++%f.randoms.length]});
 else if(kind==='fade')fadeFatalPalette(s,data);
 else if(kind==='reset')resetAfterDeath(s);
 else if(kind==='launch')prepareLaunch(s);
 else if(kind==='count')countLevels(s);
 else if(kind==='levelClear')setupLevelClear(s);
 for(const key of Object.keys(c.after))eq(s[key],c.after[key],`${kind} ${count} ${key}`);
 eq(at-c.randomOffset,c.randomReads,`${kind} ${count} random reads`);count++;
}
console.log(`Lifecycle: ${count} original state/arithmetic cases GREEN.`);
for(const c of f.trajectories) {
 const s=structuredClone(c.before);let at=0,frames=0,flashGate=2,restarts=0;const writes=[];
 const sound=new SoundDriver(soundData);sound.parameters.set(c.parameters);sound.bindFlight(s);sound.registers.set(c.registers);
 const jingle=new JingleDriver(soundData,{song:1});jingle.active=false;jingle.registers=sound.registers;
 jingle.levels.set(c.jingle.levels);jingle.deltas.set(c.jingle.deltas);jingle.frequencies.set(c.jingle.frequencies);
 const originalWrite=sound.write.bind(sound);sound.write=(i,v)=>{writes.push([i,v&255]);originalWrite(i,v);};
 const originalJingleWrite=jingle.write.bind(jingle);jingle.write=(i,v)=>{writes.push([i,v&255]);originalJingleWrite(i,v);};
 const context={random:()=>f.randoms[at++%f.randoms.length],sound,jingle,messages:systemsData.messages,
  refreshHud(){},restart(){restarts++;}};
 const generator=c.mission?missionReturn(s,data,context):c.address===0x826f?jaggiDeathTail(s,data,context):crashDeath(s,data,context);
 const controller=new LifecycleController(s);controller.start(generator);
 while(controller.active) {
  frames++;s.clock=(s.clock+1)&255;
  if(c.mission){if(jingle.active)jingle.step();s.musicActive=jingle.active?1:0;}
  else {if(--flashGate){if(s.introCounter)tickCrashFlash(s,context);}else flashGate=2;}
  sound.bindFlight(s);controller.step();if(frames>40000)throw new Error(`${c.name} exceeded original foreground budget`);
 }
 sound.bindFlight(s);
 for(const key of Object.keys(c.after))eq(s[key],c.after[key],`${c.name} ${key}`);
 eq([...sound.parameters],c.parametersAfter,`${c.name} sound parameters`);
 eq(writes,c.writes,`${c.name} ordered POKEY writes`);eq(frames,c.frames,`${c.name} explicit VBI waits`);
 eq(at,c.randomReads,`${c.name} random reads`);eq(restarts,c.mission?0:1,`${c.name} restart handoff`);
 console.log(`PASS ${c.name}: ${frames} logical VBIs, ${writes.length} POKEY writes.`);
}
