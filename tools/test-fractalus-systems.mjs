import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createSystemState,dispatchCommand,tickLockIndicator} from '../rescue-on-fractalus/systems.mjs';
import {attachFlightServices} from '../rescue-on-fractalus/flight-services.mjs';
const data=JSON.parse(fs.readFileSync(new URL('../rescue-on-fractalus/assets/systems.json',import.meta.url)));
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('fixtures/fractalus-systems.json.gz',import.meta.url))));
const hooks=attachFlightServices({terrain:new Uint8Array(256),objects:new Uint8Array(256),random:()=>0});
function compare(state,want,label){for(const [key,value]of Object.entries(want))assert.deepEqual(state[key],value,`${label} ${key}`);}
for(const [i,c]of fixture.commands.entries()){
 const state=createSystemState(structuredClone(c.before));dispatchCommand(state,c.key,{messages:data.messages,hooks});compare(state,c.after,`command ${i} key${c.key}`);
}
for(const [i,c]of fixture.locks.entries()){
 const state=createSystemState(structuredClone(c.before));tickLockIndicator(state,()=>c.random);compare(state,c.after,`indicator ${i}`);
}
console.log(`PASS ${fixture.commands.length} complete original commands and ${fixture.locks.length} lock-on indicator states with no isolated callees.`);
