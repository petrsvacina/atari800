// Native original PMG bitmap writers. Original6502 is used only by offline tests.
import{cockpitAssets,updateArtificialHorizon}from'./cockpit.mjs';
const byte=value=>value&255;
export const SPRITE_FIELDS = {
  p2FirstRow: [0x2865, 1], p2RowCount: [0x2866, 1], p2Animation: [0x2867, 1],
  p2Quarter: [0x2868, 1], p2Offset: [0x2869, 1], p2Floor: [0x286d, 1],
  p2HalfWidth: [0x286e, 1], p2PreviousFrame: [0x284a, 1],
  p2Hpos: [0xcb, 1], p2Size: [0xcd, 1], p2Colour: [0x37, 1],
  figureAlien: [0x283a, 1], figureGate: [0x7a, 1],
  p3ShapeBase: [0x2822, 1], p3Extent: [0x2823, 1], p3Mask: [0x2825, 1],
  p3PreviousRows: [0x2835, 1], p3DrawRow: [0x286f, 1], p3Hpos: [0x2870, 1],
  p3ScopeHpos: [0xcc, 1], targetWindowY: [0x2845, 1], p3ScopeCursor: [0x2846, 1],
  p3IndicatorHpos: [0x2847, 1], p3PilotFlag: [0x2839, 1],
  scannerBearing: [0x28d9, 1], scannerRange: [0x28da, 1],
  scannerRow: [0xb9, 1], scannerHpos: [0xce, 1],
  ahCacheRoll: [0x2872, 1], ahCachePitch: [0x2874, 1],
  altitudeGroundCache: [0x2875, 1], altitudeShipCache: [0x2876, 1]
};
let assets;
const banks=new WeakMap();
const decode=value=>typeof value==='string'?Uint8Array.from(atob(value),c=>c.charCodeAt(0)):new Uint8Array(value);
export function prepareSprites(data){assets={...data};for(const key of['initialP2','initialP3','initialMissiles'])assets[key]=decode(data[key]);return assets;}
export async function loadSprites(url=new URL('./assets/sprites.json',import.meta.url)){if(assets)return assets;const r=await fetch(url);if(!r.ok)throw new Error(`Sprite assets:${r.status}`);return prepareSprites(await r.json());}
function graphicData(data){if(data)return data;if(!assets)throw new Error('Call loadSprites first');return assets;}
export function createSpriteState(initial={},data=graphicData()) {
 // Atari PMG is five adjacent bitmap planes. The first scanner clear can
 // legitimately touch the following plane before its cursor is initialized.
 const graphicBank=new Uint8Array(6*256),pm={graphicBank,p3Size:initial.p3Size??0};
 for(const [index,name]of ['missiles','p0','p1','p2','p3'].entries()) {
  const rows=pm[name]=graphicBank.subarray(index*256,(index+1)*256);
  const value=initial[name]??data[{missiles:'initialMissiles',p2:'initialP2',p3:'initialP3'}[name]];
  if(value)rows.set(decode(value));banks.set(rows,{graphicBank,start:index*256});
 }
 return pm;
}
function pixelRead(rows,index){const owner=banks.get(rows);return owner?owner.graphicBank[owner.start+index]??0:rows[index]??0;}
function pixelWrite(rows,index,value){const owner=banks.get(rows);if(owner){const at=owner.start+index;if(at<0||at>=owner.graphicBank.length)throw new RangeError('PMG write outside original graphic banks');owner.graphicBank[at]=byte(value);}else if(index>=0&&index<rows.length)rows[index]=byte(value);else throw new RangeError('PMG write outside original graphic bank');}
// $8C58-$8DB4: bitmap reconstruction, scaling and the original expansion/shrink phase.
export function updatePlayer2(s,pm,{spanTable}={},data=graphicData()) {
 const spans=spanTable??s.spriteSpans;if(!spans||spans.length!==32)throw new Error('Original32-byte pitch/roll span table required');
 let x=s.p2FirstRow??0;
 for(let n=s.p2RowCount??0;n;n--)pixelWrite(pm.p2,0x32+byte(x++),0);
 s.p2HalfWidth=0;s.p2Size=0;s.p2Animation=s.objectFrame;
 const position=s.objectScreenXHi,fraction=position&3,index=(position>>>2)-16;
 s.p2Quarter=fraction;
 let offset;
 if(index<0)offset=spans[0];
 else if(index>=31)offset=spans[31];
 else{const sum=byte(spans[index]*(4-fraction)+spans[index+1]*fraction);offset=byte(((sum<<24)>>24)>>2);}
 s.p2Offset=offset;
 const finish=()=>{s.objectFrame=0;s.p2PreviousFrame=1;};
 let phase=s.objectFrame,repeat=1,start,shape;
 if(phase===26){finish();return;}
 if(phase<26) {
  s.p2PreviousFrame=phase;
  start=byte(data.p2Offsets[phase]+s.objectScreenYHi+offset);if(start&128)start=88;
  shape=data.p2NormalFrames[Math.min(7,s.objectFrame)];
 } else {
  const old=s.p2PreviousFrame;let t=s.projectileStateA;
  if(t===0){s.p2Colour=14;const i=Math.min(8,old);s.projectileStateC=data.p2ExplosionLimits[i];s.p2Floor=data.p2ExplosionStarts[i];t=s.projectileStateA=s.p2Floor;}
  if(t>=s.projectileStateC){s.p2Colour=62;s.projectileStateB=255;}
  t=s.projectileStateA=byte(t+s.projectileStateB);
  start=byte(data.p2Offsets[old]-data.p2ExplosionOffsets[t]+s.objectScreenYHi+offset);if(start&128)start=88;
  if(s.projectileStateB&128){s.p2Colour=byte(s.p2Colour-1);if(t<s.p2Floor){finish();return;}}
  if(t>=10){s.p2HalfWidth=12;s.p2Size=3;repeat=4;}
  else if(t>=7){s.p2HalfWidth=4;s.p2Size=1;repeat=2;}
  shape=data.p2ExplosionFrames[t];
 }
 s.p2FirstRow=start;x=start;
 if(!(s.landingInhibit&&s.figureIsAlien&&!s.figureGate)) {
  for(let i=shape;i<data.p2Shapes.length&&data.p2Shapes[i];i++)for(let row=0;row<repeat;row++)if(x<86)pixelWrite(pm.p2,0x32+x++,data.p2Shapes[i]);
 }
 s.p2RowCount=byte(x-start);s.objectFrame=byte(s.objectFrame+1);s.p2Hpos=byte(position-s.p2HalfWidth);
}
// $42A7-$43C6: projected P3 bitmap and its second copy in the targeting scope.
export function updatePlayer3(s,pm,{random}={},data=graphicData()) {
 const frame=s.objectIndex;let threshold,mask;
 if(frame>=3){pm.p3Size=0;s.p3Extent=12;mask=255;threshold=108;}
 else {
  pm.p3Size=data.p3Sizes[frame];s.p3Extent=data.p3Extents[frame];
  let value=s.visibleObjectY>=139?55:byte(s.visibleObjectY-86);if(value&128)value=0;value>>>=2;
  if(frame===0){mask=data.p3MasksNear[value];threshold=84;}
  else{mask=data.p3MasksFar[value>>>1];threshold=94;}
 }
 s.p3Mask=mask;
 let oldRow=Math.max(20,s.p3DrawRow??0);
 for(let n=s.p3PreviousRows??0;n;n--){pixelWrite(pm.p3,0x1e+oldRow,0);if(oldRow<79)pixelWrite(pm.p3,0x71+oldRow,0);oldRow=byte(oldRow+1);}
 if(frame&128){s.objectIndex=byte(frame-1);return;}
 if(frame>=32)return;
 const chain=frame>=21?73:frame>=12?72:s.p3ShapeBase+9*(frame>=9?7:frame>=7?6:frame>=5?5:frame);
 let row=Math.max(7,Math.min(113,s.visibleObjectX));if(chain<45)row=byte(row-data.p3RowOffsets[chain]);
 s.p3DrawRow=row;
 const shape=data.p3Shapes[chain];if(!shape)throw new RangeError('Original P3shape index out of range');
 let drawn=0;
 do {
  const dither=s.objectDither||random?.();if(dither===undefined)throw new Error('Original RANDOM source required for P3dither');
  const bits=dither&shape[drawn];if(!bits)break;
  if(row>=20){if(row<115)pixelWrite(pm.p3,0x1e+row,bits);drawn++;if(row>=46&&row<79)pixelWrite(pm.p3,0x71+row,bits&mask);}
  row=byte(row+1);
 }while(row<128);
 s.p3PreviousRows=drawn;s.p3Hpos=byte(s.p3Extent+s.visibleObjectY);
 s.p3ScopeHpos=s.p3Hpos>=142?141:Math.max(threshold,s.p3Hpos);
}
// $4467: the separate five-row targeting-scope object indicator.
export function updateStripe(s,pm,options={},data=graphicData()) {
 let row=s.p3ScopeCursor;
 if(row!==s.targetWindowY) {
  for(let i=0;i<5;i++)pixelWrite(pm.p3,0x98+byte(row++),0);
  row=s.targetWindowY;if((row&128)||row>=43)row=0;s.p3ScopeCursor=s.targetWindowY=row;
  if(row===0)return;
  const shape=data.scopeShapes[s.p3PilotFlag&128?0:s.figureAlien?2:1];
  for(const bits of shape)pixelWrite(pm.p3,0x98+row++,bits);
 }
 const x=s.p3IndicatorHpos;s.p3ScopeHpos=x>=108&&x<141?x:0;pm.p3Size=0;
}
// $44D6: missile-M2 long-range-scanner guide dot; preserves all other missile bits.
export function updateScanner(s,pm) {
 let row=byte(28-s.scannerRange);if((row&128)||row>=29)row=30;
 if(s.scannerRow!==row){for(let i=0;i<3;i++)pixelWrite(pm.missiles,0x91+byte(s.scannerRow+i),pixelRead(pm.missiles,0x91+byte(s.scannerRow+i))&207);for(let i=0;i<3;i++)pixelWrite(pm.missiles,0x91+row+i,pixelRead(pm.missiles,0x91+row+i)|48);s.scannerRow=row;}
 let hp=byte(s.scannerBearing+171);s.scannerHpos=hp<163||hp>=180?181:hp;
}
// $40B0/$40E5: preserve the original AH cache and incremental altimeter marks.
export function updateHudSprites(s,pm) {
 if(s.delayedCanopyRoll!==s.ahCacheRoll||s.delayedCanopyPitch!==s.ahCachePitch) {
  s.ahCacheRoll=s.delayedCanopyRoll;s.ahCachePitch=s.delayedCanopyPitch;
  updateArtificialHorizon(pm.p2,s.delayedCanopyRoll,s.delayedCanopyPitch);
 }
 if(s.spanTop!==s.altitudeGroundCache) {
  s.altitudeGroundCache=s.spanTop;let row=s.spanTop;
  do{pixelWrite(pm.p0,0x97+row,0);row=byte(row-1);}while(!(row&128));
  row=s.spanTop;do{pixelWrite(pm.p0,0x98+row,255);row=byte(row+1);}while(row<56);
 }
 if(s.spanBottom!==s.altitudeShipCache) {
  const row=s.altitudeShipCache=s.spanBottom;
  for(let i=0;i<2;i++)pixelWrite(pm.missiles,0x96+row+i,pixelRead(pm.missiles,0x96+row+i)&63);
  for(let i=0;i<2;i++)pixelWrite(pm.missiles,0x98+row+i,pixelRead(pm.missiles,0x98+row+i)|192);
 }
}
export function makeSpriteHooks(pm,options={}) {const resolve=s=>({...options,spanTable:typeof options.spanTable==='function'?options.spanTable(s):options.spanTable});return{player2:s=>updatePlayer2(s,pm,resolve(s)),player3:s=>updatePlayer3(s,pm,resolve(s)),stripe:s=>updateStripe(s,pm),scanner:s=>updateScanner(s,pm),hud:s=>updateHudSprites(s,pm)};}
function putColour(pixels,index,colour,palette) {
 colour&=254;if(pixels.length===64000){pixels[index]=colour;return;}
 const at=index*4,p=colour*3;pixels[at]=palette[p];pixels[at+1]=palette[p+1];pixels[at+2]=palette[p+2];pixels[at+3]=255;
}
// The original DLI switches P3position/colour and priority at the cockpit panel.
export function overlaySprites(pixels,s,pm,{terrain}={}) {
 const cockpit=cockpitAssets(),params=s.paletteParams??cockpit.paletteParams,palette=cockpit.palette;
 const field=terrain?.pixels?terrain.pixels():terrain;
 const bodyAllowed=(x,y)=>{if(x<0||x>=320||y<22||y>=116)return false;const i=(y-22)*320+x;if(cockpit.viewportOverlayMask[i])return false;return y<108||!field||field[((y-22)>>>1)*160+(x>>>1)]===0;};
 const player=(rows,hpos,size,colour,first,last,dashboard=false)=>{
  const scale=[2,4,2,8][size&3],left=(hpos-48)*2;
  for(let row=first;row<last;row++){const bits=rows[row],y=row-28;if(!bits)continue;
   for(let bit=0;bit<8;bit++)if(bits&(128>>>bit))for(let dx=0;dx<scale;dx++){
    const x=left+bit*scale+dx;if(x<0||x>=320||y<0||y>=200)continue;
    if(dashboard){if(y<116||y>=196||cockpit.hudNoPmg[(y-116)*320+x]!==144)continue;}
    else if(!bodyAllowed(x,y))continue;
    putColour(pixels,y*320+x,colour,palette);
   }
  }
 };
 player(pm.p3,s.p3Hpos,pm.p3Size,params[10],50,144);
 player(pm.p2,s.p2Hpos,s.p2Size,s.p2Colour,50,136);
 player(pm.p3,s.p3ScopeHpos,pm.p3Size,params[7],144,188,true);
 // M2 is the three-row long-range-scanner guide dot (2 bits, 1x size).
 const dotX=(s.scannerHpos-48)*2;
 for(let row=144;row<188;row++)for(let bit=0;bit<2;bit++)if(pm.missiles[row]&(16<<bit))for(let dx=0;dx<2;dx++) {
  const x=dotX+bit*2+dx,y=row-28;
  if(x>=0&&x<320&&y>=116&&y<196&&cockpit.hudNoPmg[(y-116)*320+x]===144)putColour(pixels,y*320+x,params[1],palette);
 }
 return pixels;
}
export function drawSprites(ctx,s,pm,options={}) {const image=ctx.getImageData(0,0,320,200);overlaySprites(image.data,s,pm,options);ctx.putImageData(image,0,0);return image.data;}
