/* Measured 6502 work used as a native simulation clock. This evaluates named
 * game-rule paths and numbers; it never executes original CPU instructions.
 * ANTIC DMA/VBI availability is calibrated to the supplied NTSC program.
 * The continuous hardware raster phase remains a documented fidelity limit. */
(function(root){'use strict';
const paths=root.BOULDER_TIMING_PATHS,plotOrder={0:0,1:1,2:2,40:3,39:4,41:5,42:6,43:7,80:8,81:9,82:10,120:11,121:12,122:13};
const byCode={};for(const [key,value]of Object.entries(paths))(byCode[Number(key.split('/')[0])]??=[]).push([key,value]);
function cell(w,misses){
 const low=(0x4c50+w.row*40+w.column-41)&255,rowCross=(w.row*2+235>255?1:0)+(w.row*2+236>255?1:0);
 let found=paths[w.key];
 if(!found&&w.code===58&&w.path.length===6){
  const [overflow,growing,open,free,chance,target]=w.path;
  const same=byCode[58].find(([key])=>{const p=key.split('/').slice(1,-1).map(Number);return p.length===6&&p[0]===overflow&&p[1]===growing&&p[2]===open&&p[4]<4&&chance<4&&p[5]===target;});
  if(same){const p=same[0].split('/').slice(1,-1).map(Number),reads=[...same[1][1]];reads[reads.length-1]=[1,40,42,81][chance];found=[same[1][0]+free-p[3],reads];}
 }
 if(!found&&byCode[w.code]){
  // Explosion steel immunity only changes the number of $0C31 draw branches:
  // nine non-plot cycles per affected cell, regardless of its location.
  const prefix=w.key.slice(0,w.key.lastIndexOf('/')+1),same=byCode[w.code].find(([key])=>key.startsWith(prefix));
  if(same&&w.plots.length>=2){const count=Number(same[0].split('/').at(-1));found=[same[1][0]+9*(w.plots.length-count),same[1][1]];}
 }
 if(!found&&byCode[w.code]){misses?.add(w.key);const candidates=byCode[w.code],best=candidates.reduce((a,b)=>Math.abs(Number(a[0].split('/').at(-1))-w.plots.length)<=Math.abs(Number(b[0].split('/').at(-1))-w.plots.length)?a:b);found=best[1];}
 let cost=found?found[0]+found[1].filter(offset=>low+offset>255).length:24+(low+41>255?1:0);
 for(const offset of w.plots)cost+=149+13*(plotOrder[offset]+1)+rowCross;
 return cost+55+(w.normalized?5:0)-(w.column===39?1:0);
}
function row(g,w){return (g.walkSound===64?21:34)+(g.amoebaWasOpen?32:19)+(g.scanDelay?17+86*g.scanDelay:19)+15+(w.row===21?-7:6);}
function scanStart(g,input={stick:15}){const stick=input.stick??(15&(input.x>0?7:input.x<0?11:15)&(input.y>0?13:input.y<0?14:15));
 let cost=187+(g.missing===16?1:6)+(stick===15?0:4)-(g.amoebaOpen?6:0)+(!g.amoebaOpen&&g.amoebaWasOpen?9:0);
 if(g.missing>=15)cost+=input.fire?(g.elapsed?17:12):6;
 if(g.twoControls&&g.player)cost+=2;
 return cost;
}
root.BoulderTiming={cell,row,scanStart,scanEnd:()=>245,cpuPerFrame:13400};
})(globalThis);
