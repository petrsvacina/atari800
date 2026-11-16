// Original Atari cockpit raster and native glyph/PMG data writers. No CPU runtime.
export const COCKPIT_WIDTH=320,COCKPIT_HEIGHT=200;
export const COCKPIT_VIEWPORT=Object.freeze({x:0,y:22,width:320,height:94,sourceWidth:160,sourceHeight:47});
let assets;
const bytes=text=>Uint8Array.from(atob(text),ch=>ch.charCodeAt(0));
const clamp=(value,min,max)=>Math.max(min,Math.min(max,Math.trunc(value)));
export function prepareCockpit(data) {
  const decoded={...data};
  for(const key of ['base','palette','viewportOverlayMask','viewportOverlay','hudFont','textFont','hudCells','hudNoPmg','ahRows','ahPattern','compassTable'])decoded[key]=typeof data[key]==='string'?bytes(data[key]):new Uint8Array(data[key]);
  if(decoded.base.length!==64000||decoded.palette.length!==768||decoded.hudFont.length!==1024)throw new Error('Invalid original cockpit assets');
  assets=decoded;return assets;
}
export async function loadCockpit(url=new URL('./assets/cockpit.json',import.meta.url)) {
  if(assets)return assets;
  const response=await fetch(url);if(!response.ok)throw new Error(`Cockpit assets: ${response.status}`);
  return prepareCockpit(await response.json());
}
export function cockpitAssets(){if(!assets)throw new Error('Call loadCockpit() first');return assets;}
function hudColours(params,y=0){return[y>=72?0:params[3],params[0],params[5],params[2],params[1]];}
function glyph4(indices,code,x,y,colours,data) {
  const glyph=(code&127)*8;
  for(let yy=0;yy<8;yy++)for(let xx=0;xx<4;xx++) {
    const value=(data.hudFont[glyph+yy]>>>(6-2*xx))&3;
    const colour=colours[value===3&&(code&128)?4:value],at=(y+yy)*320+x+xx*2;
    if(at>=0&&at+1<indices.length)indices[at]=indices[at+1]=colour;
  }
}
export function drawHudCell(indices,code,column,row,data=cockpitAssets(),params=data.paletteParams) {
  if(column<0||column>=40||row<0||row>=10)return;
  glyph4(indices,code,column*8,116+row*8,hudColours(params,row*8),data);
}
function cellAt(indices,code,address,data,params=data.paletteParams) {
  const offset=address-0x332d;
  drawHudCell(indices,code,offset%48-4,Math.floor(offset/48),data,params);
}
export function drawOriginalDigit(indices,digit,address,dim=false,data=cockpitAssets(),params=data.paletteParams) {
  const start=clamp(digit,0,9)*4,offsets=[0,1,48,49];
  for(let i=0;i<4;i++)cellAt(indices,data.digitGlyphs[start+i]|(dim?128:0),address+offsets[i],data,params);
}
function textCodes(indices,codes,x,params,data) {
  for(let n=0;n<codes.length;n++) {
    const code=codes[n],glyph=(code&63)*8,colour=[params[9],params[8],params[2],params[1]][code>>>6];
    for(let y=0;y<8;y++)for(let xx=0;xx<8;xx++) {
      const at=y*320+x+n*16+xx*2,value=data.textFont[glyph+y]&(128>>>xx)?colour:params[5];
      if(at<320*8)indices[at]=indices[at+1]=value;
    }
  }
}
// $40B0: native21-byte artificial-horizon P2 column update. Keep rows between
// simulation ticks when reproducing the original cache/one-row movement history.
export function updateArtificialHorizon(rows,roll,pitch,data=cockpitAssets()) {
  roll=clamp(roll,0,10);pitch=clamp(pitch,0,234);const source=data.ahIndex[roll];
  rows[(0x87+pitch)&255]=0;
  for(let i=0;i<21;i++)rows[(0x88+pitch+i)&255]=data.ahPattern[source+i];
  rows[(0x88+pitch+21)&255]=255;return rows;
}
// $3FDE: four original mode4 glyph cells, with the original8-bit table index.
export function compassCells(state,data=cockpitAssets()) {
  let index=(state.terrainIndex+data.compassOffsets[state.terrainSubIndex&3])&255;
  const cells=new Uint8Array(4);for(let i=3;i>=0;i--)cells[i]=data.compassTable[index--&255];return cells;
}
function writeDial(cells,first,last,threshold,data) {
  for(let column=first;column>=last;column--) {
    const pointer=data.dialPointers[column]-0x332d,odd=column&1,lit=column<threshold;
    cells[pointer]=(odd?55:52)|(lit?128:0);
    if(odd)cells[pointer+1]=56|(lit?128:0);
  }
}
export function instrumentCells(state={},data=cockpitAssets()) {
  const cells=new Uint8Array(state.cockpitCells??data.hudCells);
  if(Number.isFinite(state.thrustNotch))writeDial(cells,15,8,8+clamp(state.thrustNotch,0,8),data);
  if(Number.isFinite(state.clearance))writeDial(cells,7,0,clamp(state.clearance,0,255)>>>1,data);
  return cells;
}
function inInstrument(x,y) {return(x>=56&&x<88&&y>=118&&y<146)||(x>=108&&x<116&&y>=124&&y<180)||(x>=204&&x<212&&y>=124&&y<180);}
function instrumentBackground(data,x,y){return data.hudNoPmg[(y-116)*320+x]===144;}
function drawInstruments(out,state,params,data) {
  const initial=data.initialInstruments;
  const rows=state.ahRows?new Uint8Array(state.ahRows):new Uint8Array(data.ahRows);
  if(!state.ahRows&&Number.isFinite(state.delayedCanopyRoll)&&Number.isFinite(state.delayedCanopyPitch))updateArtificialHorizon(rows,state.delayedCanopyRoll,state.delayedCanopyPitch,data);
  for(let y=118;y<146;y++)for(let x=56;x<88;x++)if(instrumentBackground(data,x,y)) {
    const bit=(x-56)>>>2;out[y*320+x]=rows[y+28]&(128>>>bit)?params[1]:params[3];
  }
  const energy=clamp(state.energy??initial.energy,0,220),energyTop=state.energyTop??(energy===220?0:1+((220-energy)>>>2));
  const ground=clamp(state.spanTop??initial.spanTop,0,56),ship=clamp(state.spanBottom??initial.spanBottom,0,56);
  for(let y=124;y<180;y++)for(let dx=0;dx<8;dx++) {
    const yy=y-124;
    if(instrumentBackground(data,204+dx,y)) {
      const filled=state.energyRows?state.energyRows[y+28]&(128>>>Math.floor((4+dx)/4)):yy>=energyTop;
      out[y*320+204+dx]=filled?params[15]:params[3];
    }
    if(instrumentBackground(data,108+dx,y)) {
      const surface=state.altitudeRows?state.altitudeRows[y+28]&(128>>>Math.floor((20+dx)/4)):yy>=ground;
      const marker=state.missileRows?state.missileRows[y+28]&192:yy>=ship;
      out[y*320+108+dx]=surface?params[6]:marker?params[7]:params[3];
    }
  }
}
function drawCrosshair(out,state,params) {
  const hp=state.crosshairHpos;if(!Number.isFinite(hp)||hp<48)return;
  const left=(hp-48)*2,stem=left+24,right=left+34,colour=params[1];
  const fill=(x,y,w,h)=>{for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)if(xx>=0&&xx<320&&yy>=22&&yy<108)out[yy*320+xx]=colour;};
  fill(stem,49,4,14);fill(stem,72,4,14);fill(left,67,16,1);fill(right,67,16,1);
}
export function cockpitIndices(state={},terrain=null,data=cockpitAssets()) {
  const out=new Uint8Array(data.base),params=Array.from(state.paletteParams??data.paletteParams);
  if(state.messageColour!==undefined)params[9]=state.messageColour;
  for(const [name,index]of [['colorA',11],['colorB',12],['colorC',13],['colorD',14]])if(state[name]!==undefined)params[index]=state[name];
  if(terrain) {
    const source=terrain.pixels?terrain.pixels():terrain;
    if(source.length!==7520)throw new Error('Original terrain must be 160x47 indexed pixels');
    const colours=state.terrainColours??[params[13],params[14],params[11],params[12]];
    for(let y=0;y<94;y++)for(let x=0;x<320;x++) {
      const p=y*320+x,value=source[(y>>>1)*160+(x>>>1)]&3;
      out[(22+y)*320+x]=data.viewportOverlayMask[p]?data.viewportOverlay[p]:(value===3&&y>=86?6:colours[value]);
    }
  }
  const fullHud=!!(state.cockpitCells||state.paletteParams||Number.isFinite(state.thrustNotch)||Number.isFinite(state.clearance));
  if(fullHud) {
    const cells=instrumentCells(state,data);
    for(let row=0;row<10;row++)for(let col=0;col<40;col++)drawHudCell(out,cells[row*48+col+4],col,row,data,params);
    // Remaining hardware sprites (scanner guide dot, scope) retain their original
    // captured shape until the native writer supplies its own layer.
    for(let y=116;y<196;y++)for(let x=0;x<320;x++) {
      const at=y*320+x,behind=data.hudNoPmg[(y-116)*320+x];
      if(!inInstrument(x,y)&&data.base[at]!==behind)out[at]=data.base[at];
    }
  }
  if(fullHud||['energy','spanTop','spanBottom','delayedCanopyRoll','delayedCanopyPitch','ahRows'].some(key=>state[key]!==undefined))drawInstruments(out,state,params,data);
  if(Number.isFinite(state.score))textCodes(out,Array.from(String(clamp(state.score,0,999999)).padStart(6,' '),ch=>ch===' '?0:80+Number(ch)),224,params,data);
  if(typeof state.message==='string')textCodes(out,Array.from(state.message.toUpperCase().padEnd(14,' ').slice(0,14),ch=>(ch.charCodeAt(0)-32)&63),0,params,data);
  if(state.messageCells)textCodes(out,state.messageCells,0,params,data);
  if(state.scoreCells)textCodes(out,state.scoreCells,224,params,data);
  if(Number.isFinite(state.range))drawOriginalDigit(out,state.range,0x33b4,false,data,params);
  for(const [name,a,b]of [['kills',0x3413,0x3445],['quota',0x3472,0x34a4]])if(Number.isFinite(state[name])) {
    const value=clamp(state[name],0,99),dim=!!state.quotaDim&&name==='quota';drawOriginalDigit(out,Math.floor(value/10),a,dim,data,params);drawOriginalDigit(out,value%10,b,dim,data,params);
  }
  for(const [name,address,code]of [['shields',0x3355,52],['motherShip',0x3356,53],['motherShip',0x3357,54],['airlock',0x3388,52]])if(typeof state[name]==='boolean')cellAt(out,code|(state[name]?0:128),address,data,params);
  const heading=state.compassCells??(Number.isFinite(state.terrainIndex)&&Number.isFinite(state.terrainSubIndex)?compassCells(state,data):null);
  if(heading)for(let i=0;i<4;i++)glyph4(out,heading[i],144+i*8,12,[params[5],params[0],params[8],params[12],params[1]],data);
  drawCrosshair(out,state,params);
  return out;
}
export function renderCockpit(state={},terrain=null,data=cockpitAssets()) {
  const indexed=cockpitIndices(state,terrain,data),pixels=new Uint8ClampedArray(256000);
  for(let i=0;i<indexed.length;i++){const p=indexed[i]*3,at=i*4;pixels[at]=data.palette[p];pixels[at+1]=data.palette[p+1];pixels[at+2]=data.palette[p+2];pixels[at+3]=255;}
  return pixels;
}
export function drawCockpit(ctx,state={},terrain=null) {const pixels=renderCockpit(state,terrain);ctx.putImageData(new ImageData(pixels,320,200),0,0);return pixels;}
