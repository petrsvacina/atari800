// Render actual native gameplay after keyboard-only movement and shooting.
import fs from 'node:fs';import vm from 'node:vm';import zlib from 'node:zlib';
const root=new URL('../',import.meta.url),ctx=vm.createContext({Uint8Array,Uint8ClampedArray,Math});
for(const f of ['hero/assets/original.js','hero/assets/palette.js','hero/terrain.js','hero/engine.js','hero/raster.js'])vm.runInContext(fs.readFileSync(new URL(f,root),'utf8'),ctx);
const game=new ctx.Hero.Game({random:()=>0});for(let i=0;i<240;i++)game.step(i<80?{}:{right:true,fire:true});
const rgba=ctx.HeroRaster.render(game),width=1280,height=768,rows=Buffer.alloc(height*(width*4+1));
for(let y=0;y<height;y++)for(let x=0;x<width;x++){const sy=20+Math.floor(y*202/height),sx=Math.floor(x*336/width);for(let c=0;c<4;c++)rows[y*(width*4+1)+1+x*4+c]=rgba[(sy*336+sx)*4+c];}
function crc(bytes){let n=0xffffffff;for(const b of bytes){n^=b;for(let j=0;j<8;j++)n=(n>>>1)^((n&1)?0xedb88320:0);}return (n^0xffffffff)>>>0;}
function chunk(type,data){const t=Buffer.from(type),n=Buffer.alloc(4),sum=Buffer.alloc(4);n.writeUInt32BE(data.length);sum.writeUInt32BE(crc(Buffer.concat([t,data])));return Buffer.concat([n,t,data,sum]);}
const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=6;
fs.writeFileSync(new URL('portal/assets/hero.png',root),Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',zlib.deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]));
fs.copyFileSync(new URL('hero/assets/logo.svg',root),new URL('portal/assets/hero-logo.svg',root));console.log('Rendered H.E.R.O. portal cover from native gameplay.');
