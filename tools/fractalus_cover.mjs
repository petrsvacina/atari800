// Portal image from the native flight renderer and original graphics data.
import fs from 'node:fs';
import zlib from 'node:zlib';
import {Fractalus} from '../rescue-on-fractalus/engine.mjs';
import {prepareCockpit,renderCockpit} from '../rescue-on-fractalus/cockpit.mjs';
import * as spriteApi from '../rescue-on-fractalus/sprites.mjs';
const root=new URL('../',import.meta.url),names=['bootstrap','trigonometry','geometry','raster','objects','sound','rescue','systems','lifecycle','cockpit','sprites','timing'];
const data=Object.fromEntries(names.map(name=>[name,JSON.parse(fs.readFileSync(new URL(`rescue-on-fractalus/assets/${name}.json`,root)))]));
prepareCockpit(data.cockpit);spriteApi.prepareSprites(data.sprites);
const game=new Fractalus(data,{level:4,seed:11,spriteApi});
for(let i=0;i<160;i++)game.tick({port:255,fire:false});
const terrain=game.terrain(),state=game.cockpitState(),rgba=renderCockpit(state,terrain);
spriteApi.overlaySprites(rgba,state,game.pm,{terrain});
const scale=4,width=320*scale,height=200*scale,rows=Buffer.alloc((width*4+1)*height);
for(let y=0;y<height;y++)for(let x=0;x<width;x++) {
 const source=(Math.floor(y/scale)*320+Math.floor(x/scale))*4;
 rows.set(rgba.subarray(source,source+4),y*(width*4+1)+1+x*4);
}
function crc(bytes){let n=0xffffffff;for(const b of bytes){n^=b;for(let i=0;i<8;i++)n=(n>>>1)^((n&1)?0xedb88320:0);}return(n^0xffffffff)>>>0;}
function chunk(kind,data){const type=Buffer.from(kind),size=Buffer.alloc(4),sum=Buffer.alloc(4);size.writeUInt32BE(data.length);sum.writeUInt32BE(crc(Buffer.concat([type,data])));return Buffer.concat([size,type,data,sum]);}
const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=6;
fs.writeFileSync(new URL('portal/assets/rescue-on-fractalus.png',root),Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',zlib.deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]));
fs.copyFileSync(new URL('rescue-on-fractalus/assets/logo.png',root),new URL('portal/assets/rescue-on-fractalus-logo.png',root));
console.log('Rendered Rescue on Fractalus! cover from native gameplay.');
