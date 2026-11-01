// Portal artwork rendered from the actual native Shift assets.
import fs from 'node:fs';
import vm from 'node:vm';
import zlib from 'node:zlib';
import {Shift} from '../shift/engine.mjs';
import {pixels} from '../shift/screen.mjs';
vm.runInThisContext(fs.readFileSync(new URL('../shift/assets/data.js',import.meta.url),'utf8'));
function crc(data){let n=0xffffffff;for(const b of data){n^=b;for(let i=0;i<8;i++)n=(n>>>1)^((n&1)?0xedb88320:0);}return(n^0xffffffff)>>>0;}
function chunk(kind,data){const type=Buffer.from(kind),size=Buffer.alloc(4),sum=Buffer.alloc(4);size.writeUInt32BE(data.length);sum.writeUInt32BE(crc(Buffer.concat([type,data])));return Buffer.concat([size,type,data,sum]);}
function exportPng(name,source,left,top,w,h,scale=4){
  const width=w*scale,height=h*scale,rows=Buffer.alloc((width*4+1)*height);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const color=SHIFT_DATA.palette[source[(top+Math.floor(y/scale))*320+left+Math.floor(x/scale)]];
    rows.set([...color,255],y*(width*4+1)+1+x*4);
  }
  const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=6;
  fs.writeFileSync(new URL('../portal/assets/'+name,import.meta.url),Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',zlib.deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]));
}
const game=new Shift(SHIFT_DATA,17);
exportPng('shift.png',pixels(game,SHIFT_DATA),0,20,320,200);
exportPng('shift-logo.png',pixels(game,SHIFT_DATA,SHIFT_DATA.panels[0]),72,36,168,80);
console.log('Rendered original Shift gameplay and title logo for the portal.');
