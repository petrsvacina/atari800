import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import{fileURLToPath}from'node:url';
import{prepareCockpit,cockpitIndices,drawHudCell,drawOriginalDigit,updateArtificialHorizon,compassCells,instrumentCells,renderCockpit}from'../rescue-on-fractalus/cockpit.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=name=>JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));
const bytes=value=>Uint8Array.from(atob(value),ch=>ch.charCodeAt(0));
const data=prepareCockpit(read('rescue-on-fractalus/assets/cockpit.json'));
const original=read('tools/fixtures/fractalus-cockpit-view.json');
assert.equal(data.sourceSha256,original.sourceSha256);
const rendered=cockpitIndices({paletteParams:original.paletteParams},bytes(original.terrain));
assert.deepEqual(rendered.slice(22*320,116*320),bytes(original.viewport),'all30,080 original terrain/PMG pixels and exact viewport placement');
const cells=new Uint8Array(64000);
for(let row=0;row<10;row++)for(let col=0;col<40;col++)drawHudCell(cells,data.hudCells[row*48+col+4],col,row,data);
assert.deepEqual(cells.slice(116*320,196*320),bytes(original.hudNoPmg),'all25,600 original mode4 playfield pixels');
const dynamic=cockpitIndices({...original.state,paletteParams:original.paletteParams,messageCells:original.messageCells,scoreCells:original.scoreCells});
assert.deepEqual(dynamic.slice(116*320,196*320),bytes(original.hudWithPmg),'all25,600 original dynamic HUD+PMG pixels');
assert.deepEqual(dynamic.slice(0,8*320),bytes(original.header),'all2,560 original mode6 message/score pixels');
const digits=read('tools/fixtures/fractalus-cockpit-glyphs.json');
for(const c of digits.cases){const out=cockpitIndices();drawOriginalDigit(out,c.digit,c.address,c.dim);const roi=Uint8Array.from({length:c.width*c.height},(_,i)=>out[(c.y+Math.floor(i/c.width))*320+c.x+i%c.width]);assert.deepEqual(roi,bytes(c.pixels),`original digit${c.digit} dim=${c.dim}`);}
let writers=0;
const writerPath=path.join(root,'tools/fixtures/fractalus-cockpit-writers.json');
if(fs.existsSync(writerPath)){
 const reference=JSON.parse(fs.readFileSync(writerPath,'utf8'));
 for(const c of reference.ah){const rows=updateArtificialHorizon(bytes(reference.ahSeed),c.roll,c.pitch);assert.deepEqual(rows,bytes(c.rows),`original AH${c.roll}/${c.pitch}`);writers++;}
 for(const c of reference.compass){assert.deepEqual(Array.from(compassCells(c)),c.cells,`original compass${c.terrainIndex}/${c.terrainSubIndex}`);writers++;}
 for(const c of reference.dials){const state=c.kind==='clearance'?{clearance:c.value*2}:{thrustNotch:c.value};const got=instrumentCells(state),want=bytes(c.cells);for(let column=c.kind==='clearance'?0:8;column<(c.kind==='clearance'?8:16);column++){const offset=data.dialPointers[column]-0x332d;assert.equal(got[offset],want[offset]);if(column&1)assert.equal(got[offset+1],want[offset+1]);}writers++;}
}
const recoloured=cockpitIndices({colorA:18,colorB:24,colorC:32,colorD:48},new Uint8Array(7520));
assert.equal(recoloured[(22+20)*320+160],32,'native atmosphere body colour reaches viewport');
assert.equal(renderCockpit().length,256000);
console.log(`PASS30,080 original viewport pixels;25,600 original mode4 pixels;25,600 original dynamic HUD/PMG pixels;2,560 header pixels;${digits.cases.length} original glyph rasters;${writers} original instrument writers.`);
