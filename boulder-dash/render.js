/* Pixel renderer for the original ANTIC 4 cave and ANTIC 6 score line. */
(function(root){'use strict';
const D=root.BOULDER_ORIGINAL,B=root.Boulder;
class Screen{
 constructor(){this.width=320;this.height=240;this.pixels=new Uint8ClampedArray(320*240*4);this.rgb=D.palette.map((original,index)=>{const c=D.videoColors[index]||original;return [parseInt(c.slice(1,3),16),parseInt(c.slice(3,5),16),parseInt(c.slice(5,7),16)];});this.indexed=new Uint8Array(320*240);}
 char6(code,x,y,font,colors){const glyph=(code&63)*8,color=colors[code>>6];for(let row=0;row<8;row++){const bits=font[glyph+row];for(let col=0;col<8;col++)if(bits&(128>>col)){const at=(y+row)*320+x+col*2;this.indexed[at]=this.indexed[at+1]=color;}}}
 hud(g,r,intro=false){let chars;
  if(intro){chars=[...D.introTemplate];chars[7]=145+g.player;chars[10]=144+g.lives;chars[13]=g.lives===1?161:165;chars[16]=160+g.cave;chars[18]=145+g.level;}
  else chars=[0,...(g.enough?[188,188]:g.needed.map(n=>n+80)),188,...g.value.slice(1).map(n=>n+144),0,...g.diamonds.map(n=>n+80),0,...g.time.map(n=>n+144),0,...g.score.map(n=>n+144)];
  const font=Uint8Array.from(r.titleFont);font.fill(0,0,8);for(let i=0;i<20;i++)this.char6(chars[i],i*16,24,font,g.colors);
 }
 game(g,r,options={}){
  const bg=r.background;this.indexed.fill(bg);this.hud(g,r,options.intro??!!g.preSpawn);
  const tiles=Array.from({length:256},(_,base)=>r.tile(0,base)),sx=r.cameraX>>5,sy=r.cameraY>>5,cover=r.tile(0,124,true);
  for(let y=0;y<192;y++)for(let x=0;x<320;x++){
   const wx=x+sx,wy=y+sy,cx=wx>>4,cy=wy>>4,index=cy*40+cx,code=cx<0||cx>=40||cy<0||cy>=22?7:g.cells[index];
   const tile=options.reveal&&!options.reveal[index]?cover:tiles[index>=0&&index<880?g.appearance[index]:D.tileCharacters[code]]||tiles[0];this.indexed[(y+32)*320+x]=tile[(wy&15)*16+(wx&15)];
  }
  return this.finish();
 }
 title(r,modes={}){
  const colors=D.titleColors;this.indexed.fill(colors[4]);const map=new Uint8Array(40*19);map.fill(128);
  for(let i=0;i<16;i++){map[80+i]=D.titleMap[i]|128;map[400+i]=D.titleMap[256+i]|128;}
  for(let i=0;i<240;i++){map[120+i]=D.titleMap[16+i]|128;map[440+i]=D.titleMap[272+i]|128;}
  const border=3;for(let x=0;x<40;x++){map[x]=border;map[18*40+x]=border;}for(let y=0;y<19;y++){map[y*40]=border;map[y*40+39]=border;}
  for(let y=0;y<19*8;y++)for(let x=0;x<320;x++){
   const code=map[(y>>3)*40+(x>>3)],bits=r.titleFont[(code&127)*8+(y&7)],value=bits>>(6-((x&7)>>1)*2)&3;
   this.indexed[(24+y)*320+x]=value===0?colors[4]:value===3?colors[code&128?3:2]:colors[value-1];
  }
  if(modes.menu){for(let row=0;row<D.menuText.length;row++){const chars=[...D.menuText[row]];if(row===3){chars[0]=81+(modes.players?1:0);chars[10]=81+(modes.joysticks===2?1:0);}for(let i=0;i<20;i++)this.char6(chars[i],i*16,176+row*9,r.titleFont,colors);}}
  else for(let y=0;y<48;y++)for(let x=0;x<320;x++){const value=D.titleArtwork[y*40+(x>>3)]>>(6-((x&7)>>1)*2)&3;this.indexed[(176+y)*320+x]=value?colors[value-1]:colors[4];}
  return this.finish();
 }
 finish(){for(let i=0;i<this.indexed.length;i++){const c=this.rgb[this.indexed[i]],a=i*4;this.pixels[a]=c[0];this.pixels[a+1]=c[1];this.pixels[a+2]=c[2];this.pixels[a+3]=255;}return this.pixels;}
 draw(canvas,g,r,options={}){const pixels=options.title?this.title(r,options):this.game(g,r,options);const c=canvas.getContext('2d');c.putImageData(new ImageData(pixels,320,240),0,0);}
}
root.BoulderScreen=Screen;
})(globalThis);
