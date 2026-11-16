import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import * as sprites from '../rescue-on-fractalus/sprites.mjs';
import {FLIGHT_FIELDS} from '../rescue-on-fractalus/flight.mjs';
import {SERVICE_FIELDS} from '../rescue-on-fractalus/flight-services.mjs';
import {SYSTEM_FIELDS} from '../rescue-on-fractalus/systems.mjs';
import {RESCUE_FIELDS,createRescueState} from '../rescue-on-fractalus/rescue.mjs';
import {COMBAT_FIELDS} from '../rescue-on-fractalus/combat.mjs';
import {VBI_FIELDS} from '../rescue-on-fractalus/vbi.mjs';
import {linkState} from '../rescue-on-fractalus/state.mjs';
const data=JSON.parse(fs.readFileSync(new URL('../rescue-on-fractalus/assets/sprites.json',import.meta.url)));sprites.prepareSprites(data);
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('fixtures/fractalus-sprites.json.gz',import.meta.url))));
const keys=[...Object.keys(sprites.SPRITE_FIELDS),'objectFrame','projectileStateA','projectileStateB','projectileStateC','objectIndex'];
for(const [i,c]of fixture.cases.entries()) {
 const s=linkState(createRescueState(c.before),FLIGHT_FIELDS,SERVICE_FIELDS,SYSTEM_FIELDS,RESCUE_FIELDS,COMBAT_FIELDS,VBI_FIELDS,sprites.SPRITE_FIELDS);
 const pm=sprites.createSpriteState();pm.graphicBank.set(Buffer.from(c.beforePmg,'base64'));pm.p3Size=c.beforeSize;
 let read=0;const random=()=>{assert.ok(read<c.random.length,`sprite ${i} unexpected RANDOM`);return c.random[read++];};
 if(c.routine===0x8c58)sprites.updatePlayer2(s,pm,{spanTable:c.before.terrainScreenSpans});
 else if(c.routine===0x42a7)sprites.updatePlayer3(s,pm,{random});
 else if(c.routine===0x4467)sprites.updateStripe(s,pm);else sprites.updateScanner(s,pm);
 for(const key of keys)assert.equal(s[key],c.after[key],`sprite ${i} $${c.routine.toString(16)} ${key}`);
 assert.deepEqual(pm.graphicBank,Uint8Array.from(Buffer.from(c.afterPmg,'base64')),`sprite ${i} all six graphic banks`);
 assert.equal(pm.p3Size,c.afterSize,`sprite ${i} SIZEP3`);assert.equal(read,c.random.length,`sprite ${i} RNG count`);
}
console.log(`PASS ${fixture.cases.length} original P2/P3/scanner/scope writers, neighboring bitmap banks, registers, state and ordered RANDOM bytes.`);
