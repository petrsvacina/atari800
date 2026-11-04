// Portal artwork from the native Fred renderer and original game pixels.
import fs from 'node:fs';
import zlib from 'node:zlib';
import '../fred/assets/data.js';
import {Fred} from '../fred/engine.mjs';
import {Screen} from '../fred/screen.mjs';
function crc(data){let n=0xffffffff;for(const b of data){n^=b;for(let i=0;i<8;i++)n=(n>>>1)^((n&1)?0xedb88320:0);}return(n^0xffffffff)>>>0;}
function chunk(kind,data){const type=Buffer.from(kind),size=Buffer.alloc(4),sum=Buffer.alloc(4);size.writeUInt32BE(data.length);sum.writeUInt32BE(crc(Buffer.concat([type,data])));return Buffer.concat([size,type,data,sum]);}
const game=new Fred(FRED_DATA,0,()=>85);for(let i=0;i<32;i++)game.frame(7);
const pixels=new Screen(null,FRED_DATA).raster(game).pixels;
const scale=4,width=320*scale,height=200*scale,rows=Buffer.alloc((width*4+1)*height);
for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const at=pixels[(16+Math.floor(y/scale))*320+Math.floor(x/scale)]*3;
  rows.set([...FRED_DATA.palette.slice(at,at+3),255],y*(width*4+1)+1+x*4);
}
const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=6;
fs.writeFileSync(new URL('../portal/assets/fred.png',import.meta.url),Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',zlib.deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]));
fs.copyFileSync(new URL('../fred/assets/logo.png',import.meta.url),new URL('../portal/assets/fred-logo.png',import.meta.url));
console.log('Rendered Fred gameplay and copied its original title logo for the portal.');
