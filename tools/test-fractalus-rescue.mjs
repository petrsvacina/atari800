import {beginApproach,advanceApproach,drawPilot,stepAlienSequence,drawAlien,alienAttack,RescueController} from '../rescue-on-fractalus/rescue.mjs';
const read=async path=>JSON.parse(await Deno.readTextFile(new URL(path,import.meta.url)));
const data=await read('../rescue-on-fractalus/assets/rescue.json');
const compressed=await Deno.readFile(new URL('./fixtures/fractalus-rescue.json.gz',import.meta.url));
const f=await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))).json();
function eq(a,b,label){if(JSON.stringify(a)!==JSON.stringify(b)){if(Array.isArray(a)){const i=a.findIndex((v,i)=>JSON.stringify(v)!==JSON.stringify(b[i]));throw new Error(`${label}[${i}]: ${a[i]} != ${b[i]}`);}throw new Error(`${label}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`);}}
let count=0;
for(const [kind,cases] of Object.entries(f.cases))for(const c of cases) {
 const s=structuredClone(c.before),context={objects:new Uint8Array(256)};
 let at=c.randomOffset??0;context.random=()=>f.randoms[at++%f.randoms.length];
 if(c.source){context.sourceField=new Uint8Array(c.source);context.field=new Uint8Array(c.destination);}
 if(kind==='begin'){context.objects[s.rescueCell]=c.marker;beginApproach(s,context,{entryX:c.x});}
 else if(kind==='approach')advanceApproach(s,context);
 else if(kind==='pilot')drawPilot(s,data,context);
 else if(kind==='alienSequence')stepAlienSequence(s,data,context);
 else if(kind==='alienDraw')drawAlien(s,data,context);
 else if(kind==='attack')alienAttack(s,context);
 for(const key of Object.keys(c.after))eq(s[key],c.after[key],`${kind} ${count} ${key}`);
 if(c.fieldAfter)eq([...context.field],c.fieldAfter,`${kind} ${count} field`);
 if(c.randomReads!==undefined)eq(at-(c.randomOffset??0),c.randomReads,`${kind} ${count} random reads`);
 count++;
}
console.log(`Rescue original routines: ${count} state/graphics cases GREEN.`);
let scheduled=0;
for(const c of f.scheduled??[]) {
 const s=structuredClone(c.before);let at=0,frames=0;
 const context={terrain:new Uint8Array(c.terrain),objects:new Uint8Array(c.objects),visibleCells:new Uint8Array(c.visible),
   sourceField:new Uint8Array(c.source),field:new Uint8Array(c.destination),random:()=>f.randoms[at++%f.randoms.length],
   sound:{write(){throw new Error('Unexpected direct tone in human/open-airlock fixture');}},
   death(){throw new Error('Unexpected root death in human/open-airlock fixture');}};
 const controller=new RescueController(data,s,context);controller.start();let finished=false;
 while(controller.active) {
   if(s.landingPhase===c.finishPhase&&!finished){s.systemsOff=0;finished=true;}
   else {s.clock=(s.clock+1)&255;frames++;}
   if(frames>30000)throw new Error(`Controller ${c.name} never finished phase=${s.landingPhase},wait=${JSON.stringify(controller.waiting)}`);
   controller.step();
 }
 for(const key of Object.keys(c.after))eq(s[key],c.after[key],`scheduled ${c.name} ${key}`);
 eq([...context.field],c.fieldAfter,`scheduled ${c.name} field`);
 eq([...context.objects],c.objectsAfter,`scheduled ${c.name} occupants`);
 eq(at,c.randomReads,`scheduled ${c.name} random reads`);eq(frames,c.frames,`scheduled ${c.name} explicit wait frames`);
 scheduled++;
}
console.log(`Rescue scheduling: ${scheduled} complete original foreground trajectories GREEN (explicit waits; no drawing-cycle claim).`);
for(const c of f.outside??[]) {
 const s=structuredClone(c.before);let at=0,frames=0,dead=false;const writes=[];
 const context={terrain:new Uint8Array(c.terrain),objects:new Uint8Array(c.objects),visibleCells:new Uint8Array(c.visible),
  sourceField:new Uint8Array(c.source),field:new Uint8Array(c.destination),random:()=>f.randoms[at++%f.randoms.length],
  sound:{write:(index,value)=>writes.push([index,value])},death:function*(){dead=true;}};
 const controller=new RescueController(data,s,context);controller.start();
 while(controller.active){s.clock=(s.clock+1)&255;frames++;if(c.abortAt!==null&&frames>=c.abortAt)s.systemsOff=0;controller.step();if(frames>10000)throw new Error('Jaggi never terminates');}
 for(const key of Object.keys(c.after))eq(s[key],c.after[key],`outside ${c.name} ${key}`);
 eq([...context.field],c.fieldAfter,`outside ${c.name} field`);eq([...context.objects],c.objectsAfter,`outside ${c.name} occupants`);
 eq(at,c.randomReads,`outside ${c.name} random reads`);eq(frames,c.frames,`outside ${c.name} explicit wait frames`);
 eq(writes,c.writes,`outside ${c.name} POKEY writes`);eq(dead,c.dead,`outside ${c.name} fatal transition`);
}
console.log(`Closed-airlock Jaggi: ${(f.outside??[]).length} complete scheduled bitmap/direct-tone trajectories GREEN.`);
