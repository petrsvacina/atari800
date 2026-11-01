/* Render the portal cover from the actual native game's opening screen. */
import fs from 'node:fs';
import vm from 'node:vm';
import zlib from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {Adventure} from '../neverending-story/engine.mjs';
import {render} from '../neverending-story/screen.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
vm.runInThisContext(fs.readFileSync(root + 'neverending-story/assets/data.js', 'utf8'));
const game = new Adventure(NEVERENDING_DATA.rules, {random: () => 128, pause: async () => {}});
await game.start();
let screen;
render({getContext: () => ({createImageData: (w,h) => ({data: new Uint8Array(w*h*4)}), putImageData: frame => { screen = frame.data; }})}, NEVERENDING_DATA, game, 'cs');
const width = 1280, height = 800, scanlines = Buffer.alloc((width * 4 + 1) * height);
for (let y=0;y<height;y++) for(let x=0;x<width;x++) {
  const i=((y>>2)*320+(x>>2))*4, p=y*(width*4+1)+1+x*4;
  scanlines.set(screen.subarray(i,i+4),p);
}
function crc(data) {let n=0xffffffff;for(const b of data){n^=b;for(let i=0;i<8;i++)n=(n>>>1)^((n&1)?0xedb88320:0);}return (n^0xffffffff)>>>0;}
function chunk(kind,data){const type=Buffer.from(kind),n=Buffer.alloc(4),c=Buffer.alloc(4);n.writeUInt32BE(data.length);c.writeUInt32BE(crc(Buffer.concat([type,data])));return Buffer.concat([n,type,data,c]);}
const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=6;
const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',zlib.deflateSync(scanlines)),chunk('IEND',Buffer.alloc(0))]);
fs.writeFileSync(root+'portal/assets/neverending-story.png',png);
console.log('Rendered original opening screen into portal cover.');
