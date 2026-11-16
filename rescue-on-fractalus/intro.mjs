// Lossless original raster/sound animation data, rendered by native Canvas.
// The original CPU is used only by the offline capture tools.
import {drawOriginalDigit,cockpitIndices} from './cockpit.mjs';

const bytes=text=>Uint8Array.from(atob(text),ch=>ch.charCodeAt(0));
function integer(stream) {
  let value=0,shift=0,byte;
  do {
    if(stream.at>=stream.data.length||shift>21)throw new Error('Invalid intro packet');
    byte=stream.data[stream.at++];value+=(byte&127)*2**shift;shift+=7;
  }while(byte&128);
  return value;
}
export function applyIntroPatch(pixels,stream) {
  const count=integer(stream);let cursor=0;
  for(let i=0;i<count;i++) {
    cursor+=integer(stream);const length=integer(stream),end=cursor+length;
    if(!length||end>pixels.length||stream.at>=stream.data.length)throw new Error('Invalid intro raster');
    pixels.fill(stream.data[stream.at++],cursor,end);cursor=end;
  }
}
export async function prepareIntro(data) {
  if(data.schema!==1||data.width!==320||data.height!==200)throw new Error('Invalid intro assets');
  const decoded={...data,palette:bytes(data.palette),glyphs:{...data.glyphs,patches:bytes(data.glyphs.patches)}};
  for(const name of ['logo','station','launch']) {
    const clip=data[name],compressed=bytes(clip.patches);
    const stream=new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'));
    const patches=new Uint8Array(await new Response(stream).arrayBuffer()),sound=bytes(clip.sound);
    if(patches.length!==clip.patchBytes||sound.length!==clip.frames*9)throw new Error('Incomplete intro assets');
    decoded[name]={...clip,patches,sound};
  }
  if(decoded.palette.length!==768)throw new Error('Invalid intro palette');
  return decoded;
}

function counterOverlay(state) {
  const quota=state.quota??4,score=state.score??0,overlays=[];
  if(quota!==4)for(const dim of [false,true]) {
    const original=new Uint8Array(64000).fill(255),selected=original.slice();
    for(const [digit,address]of [[0,0x3472],[4,0x34a4]])drawOriginalDigit(original,digit,address,dim);
    drawOriginalDigit(selected,Math.floor(quota/10),0x3472,dim);drawOriginalDigit(selected,quota%10,0x34a4,dim);
    const positions=[];for(let i=0;i<original.length;i++)if(original[i]!==255)positions.push(i);
    overlays.push({original,selected,positions});
  }
  if(score) {
    const original=cockpitIndices({score:0}),selected=cockpitIndices({score,scoreCells:state.scoreCells});
    const positions=[];for(let y=0;y<8;y++)for(let x=224;x<320;x++)positions.push(y*320+x);
    overlays.push({original,selected,positions});
  }
  return pixels=>{
    for(const {original,selected,positions}of overlays)if(positions.every(at=>pixels[at]===original[at]))for(const at of positions)pixels[at]=selected[at];
  };
}

export class IntroSequence {
  constructor(data,{level=4,includeStation=true,state={}}={}) {
    this.data=data;this.level=Math.max(1,Math.min(99,Math.trunc(level)));this.segments=includeStation?['logo','station','launch']:['launch'];
    this.segment=0;this.base=new Uint8Array(64000);this.output=new Uint8Array(64000);this.rgba=new Uint8ClampedArray(256000);
    this.counters=counterOverlay(state);this.done=false;this.begin();
  }
  begin() {
    this.name=this.segments[this.segment];this.clip=this.data[this.name];this.frame=0;this.base.fill(0);
    this.stream={data:this.clip.patches,at:0};applyIntroPatch(this.base,this.stream);this.compose();
  }
  get phase(){let phase=this.clip.phases[0][1];for(const [frame,value]of this.clip.phases){if(frame>this.frame)break;phase=value;}return phase;}
  get registers(){return this.clip.sound.subarray(this.frame*9,this.frame*9+9);}
  compose() {
    this.output.set(this.base);
    if(this.name==='launch') {
      const glyphs=this.data.glyphs;
      if(this.frame<glyphs.frames)for(const [side,digit]of [[0,Math.floor(this.level/10)],[1,this.level%10]]) {
        const id=glyphs.selectors[this.frame][side][digit];
        applyIntroPatch(this.output,{data:glyphs.patches,at:glyphs.offsets[id]});
      }
      this.counters(this.output);
    }
  }
  tick() {
    if(this.done)return false;
    if(this.frame+1<this.clip.frames){this.frame++;applyIntroPatch(this.base,this.stream);this.compose();return true;}
    if(this.stream.at!==this.stream.data.length)throw new Error('Unused intro raster data');
    if(++this.segment<this.segments.length){this.begin();return true;}
    this.done=true;return false;
  }
  draw(ctx) {
    const palette=this.data.palette;
    for(let i=0;i<this.output.length;i++){const p=this.output[i]*3,at=i*4;this.rgba[at]=palette[p];this.rgba[at+1]=palette[p+1];this.rgba[at+2]=palette[p+2];this.rgba[at+3]=255;}
    ctx.putImageData(new ImageData(this.rgba,320,200),0,0);
  }
}
