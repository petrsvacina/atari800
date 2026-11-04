import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import '../fred/assets/data.js';
import {Fred} from '../fred/engine.mjs';
import {Screen} from '../fred/screen.mjs';
const fixtures=JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('fixtures/fred-raster.json.gz',import.meta.url))));
for(const f of fixtures){
  const game=new Fred(FRED_DATA,f.level,()=>85);for(let i=0;i<f.frames;i++)game.frame(f.stick);
  if(f.state){Object.assign(game,structuredClone(f.state));game.drawHero();if(f.paintProjectile)game.drawProjectile(63);game.presentation=game.snapshot();}
  if(f.stage){game.nextLevel();for(let i=0;i<f.stage;i++)game.advanceStage();}
  const raster=new Screen(null,FRED_DATA).raster(game);
  const expected=Buffer.from(f.pixels,'base64'),actual=Buffer.from(raster.pixels),tolerated=[];
  for(let i=0;i<expected.length;i++)if(actual[i]!==expected[i]) {
    // A 6502 IRQ can start a few cycles later depending on the instruction it
    // interrupts. The progress-line PF2 write can straddle this one pixel pair.
    const colors=[FRED_DATA.levels[f.level].colors[6],FRED_DATA.hudColors[2]];
    if(Math.floor(i/320)===154&&colors.includes(actual[i])&&colors.includes(expected[i])){
      tolerated.push(i);actual[i]=expected[i];
    }
  }
  assert.ok(tolerated.length<=2,`${f.name}: unexpected DLI boundary drift`);
  const differences=[];for(let i=0;i<expected.length;i++)if(actual[i]!==expected[i])differences.push([i%320,Math.floor(i/320),actual[i],expected[i]]);
  assert.equal(differences.length,0,`${f.name}: ${JSON.stringify(differences.slice(0,8))}`);
  if(f.collisions)assert.deepEqual(raster.collisions,f.collisions,`${f.name} GTIA hardware collision latches`);
}
console.log(`PASS ${fixtures.length} original 320×240 scanouts and GTIA collision latches (up to two PF2 pixels at the DLI palette boundary).`);
