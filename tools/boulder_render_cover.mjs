// Render the original title glyphs and a reproducible native gameplay cover.
import fs from'node:fs';import vm from'node:vm';import zlib from'node:zlib';
const root=new URL('../',import.meta.url),s=vm.createContext({});for(const f of ['assets/original.js','engine.js','raster.js','render.js'])vm.runInContext(fs.readFileSync(new URL('boulder-dash/'+f,root),'utf8'),s);
const g=new s.Boulder.Cave(),r=new s.BoulderRaster(g),screen=new s.BoulderScreen();for(let i=0;i<12;i++)r.titleFrame();const title=screen.title(r).slice();
function crc(bytes){let n=0xffffffff;for(const b of bytes){n^=b;for(let j=0;j<8;j++)n=n>>>1^((n&1)?0xedb88320:0);}return(n^0xffffffff)>>>0;}
function chunk(type,data){const t=Buffer.from(type),n=Buffer.alloc(4),sum=Buffer.alloc(4);n.writeUInt32BE(data.length);sum.writeUInt32BE(crc(Buffer.concat([t,data])));return Buffer.concat([n,t,data,sum]);}
function png(file,width,height,pixel){const rows=Buffer.alloc(height*(width*4+1));for(let y=0;y<height;y++)for(let x=0;x<width;x++)rows.set(pixel(x,y),y*(width*4+1)+1+x*4);const h=Buffer.alloc(13);h.writeUInt32BE(width);h.writeUInt32BE(height,4);h[8]=8;h[9]=6;fs.writeFileSync(new URL(file,root),Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',h),chunk('IDAT',zlib.deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]));}
png('boulder-dash/assets/logo.png',608,256,(x,y)=>{const at=((36+(y>>1))*320+8+(x>>1))*4;return title.slice(at,at+4);});fs.copyFileSync(new URL('boulder-dash/assets/logo.png',root),new URL('portal/assets/boulder-dash-logo.png',root));
g.preSpawn=g.spawnSeconds=0;let seed=37;g.randomByte=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed>>>24;};
for(let i=0;i<70;i++){g.step({x:i<20?1:0,y:i>=20&&i<40?1:0});for(let v=0;v<9;v++){r.frame();g.frame();r.endFrame();}}
const image=screen.game(g,r);png('portal/assets/boulder-dash.png',1280,768,(x,y)=>{if(x<128||x>=1152)return[20,21,16,255];const at=(Math.floor(y*240/768)*320+Math.floor((x-128)*320/1024))*4;return image.slice(at,at+4);});console.log('Rendered Boulder Dash logo and portal cover from original glyphs and native gameplay.');
