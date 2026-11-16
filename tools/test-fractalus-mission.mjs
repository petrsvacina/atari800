import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {levelParameters,addScore,advanceRescueCounter} from '../rescue-on-fractalus/mission.mjs';
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('fixtures/fractalus-mission.json.gz',import.meta.url))));
for(const c of fixture.levels)assert.deepEqual(levelParameters(c.level,{nightPhase:c.nightPhase}),c.expected,`level ${c.level}`);
for(const c of fixture.scores){const state={score:c.score,pendingScore:c.delta,scoreCells:[65,66,67,68,69,70]};addScore(state,c.delta);assert.deepEqual(state,c.expected,`score ${c.score}+${c.delta}`);}
for(const c of fixture.rescues){const state={remainingBcd:c.remainingBcd,overQuota:c.overQuota,rescued:0,pendingScore:0};advanceRescueCounter(state,{ace:c.ace});assert.deepEqual(state,c.expected,`rescue ${JSON.stringify(c)}`);}
console.log(`PASS ${fixture.levels.length} original level setups, ${fixture.scores.length} decimal score additions and ${fixture.rescues.length} bounded rescue-counter cases.`);
