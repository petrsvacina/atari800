/* Original ANTIC glyph data, animation and scrolling, rendered as indexed pixels. */
(function(root){'use strict';
const D=root.BOULDER_ORIGINAL;
class Raster{
 constructor(game){this.g=game;this.font=Uint8Array.from(D.font);this.titleFont=Uint8Array.from(D.titleFont);this.phase=0;this.clock=0;this.blink=0;this.tap=0;this.cameraX=0;this.cameraY=0;this.vx=0;this.vy=0;this.background=game.colors[4];this.magicAppearance=0;
  for(let i=0;i<8;i++)for(const offset of [0,8,128,136])this.font[0x110+offset+i]=this.font[0x270+i];}
 titleFrame(){
  if(!this.titleClock){this.titleFont.set(D.titleFont.slice(0x58,0x60),0);}this.titleClock=(this.titleClock||0)+1;
  if(!(this.titleClock&1)){const first=this.titleFont[0];this.titleFont.copyWithin(0,1,8);this.titleFont[7]=first;for(let i=0;i<8;i++){this.titleFont[0x48+i]=this.titleFont[0x30+i]|this.titleFont[i];this.titleFont[0x50+i]=this.titleFont[0x38+i]|this.titleFont[i];}}
 }
 coverFrame(){const g=this.g;g.sound(5,170);g.sound(4,g.randomByte()&15);const first=this.font[0x3e0];this.font.copyWithin(0x3e0,0x3e1,0x3e8);this.font[0x3e7]=first;}
 reset(){this.cameraX=this.cameraY=this.vx=this.vy=0;}
 quartet(source,target,x,y){for(const offset of [0,8,128,136])this.font[target+offset+y]=source[x+offset];}
 animate(){
  const g=this.g,phase=this.phase*2;
  for(let row=0;row<8;row++){
   const index=phase+row;
   this.quartet(D.animation[5],0x240,index,row); // $4A00 butterfly -> $4640
   this.quartet(D.animation[3],0x200,index,row); // $4800 firefly -> $4600
   this.quartet(D.animation[6],0x100,index,row); // $4B00 diamond -> $4500
   this.quartet(D.animation[4],0x320,index,row); // $4900 amoeba -> $4720
   if(g.stick!==15){this.blink=this.tap=0;this.quartet(D.animation[g.facing?1:2],0x260,index,row);}
   else{
    if(!index){this.blink=!(g.randomByte()&3)?1:0;if(!(g.randomByte()&15))this.tap^=1;}
    for(const offset of [0,8])this.font[0x260+offset+row]=this.blink?D.animation[0][index+offset]:this.font[0x210+offset+row];
    for(const offset of [0,8])this.font[0x2e0+offset+row]=this.tap?D.animation[0][index+128+offset]:this.font[0x290+offset+row];
   }
  }
 }
 scroll(){
  const g=this.g;if(g.cave>=17&&!g.spawnSeconds)return;
  const rx=(g.playerX-(this.cameraX>>9))&255,ry=(g.playerY-(this.cameraY>>9))&255;
  for(let i=9;i>=0;i-=3){if(ry===D.cameraY[i])this.vy=(D.cameraY[i+1]|D.cameraY[i+2]<<8)<<16>>16;if(rx===D.cameraX[i])this.vx=(D.cameraX[i+1]|D.cameraX[i+2]<<8)<<16>>16;}
  if(!((ry-11)&128))this.vy=64;if((ry-5)&128)this.vy=-64;
  if(!((rx-17)&128))this.vx=64;if((rx-3)&128)this.vx=-64;
  if(!(this.cameraY&255)&&(this.cameraY===0&&this.vy<0||this.cameraY===21*256&&this.vy>=0))this.vy=0;
  if(!(this.cameraX&255)&&(this.cameraX===0&&this.vx<0||this.cameraX===40*256&&this.vx>=0))this.vx=0;
  this.cameraX=(this.cameraX+this.vx)&65535;this.cameraY=(this.cameraY+this.vy)&65535;
 }
 magic(){
  const g=this.g;
  if(g.magicState===1){
   this.magicAppearance=1;g.magicNoisePitch=(g.randomByte()&7)+10;g.sound(4,g.magicNoisePitch);g.sound(5,166);
   for(let i=0;i<8;i++)for(const offset of [0,8,128,136])this.font[0x110+offset+i]=this.font[0x360+((this.phase+i)&31)];
  }else if(g.magicState===2){
   for(let i=0;i<8;i++)for(const offset of [0,8,128,136])this.font[0x110+offset+i]=this.font[0x270+i];g.magicState=3;this.magicAppearance=0;g.sound(5,0);
  }
 }
 frame(){
  const g=this.g;this.background=g.colors[4]&240;if(g.flash){this.background|=15;g.flash--;}
  this.magic();
  this.clock=(this.clock+1)&255;if(!(this.clock&1)){this.phase=(this.phase+8)&63;this.animate();this.magic();}
  this.scroll();
 }
 endFrame(){
  const g=this.g;
  if(g.bonusFlash){
   if(g.bonusFlash===1){for(let i=0;i<8;i+=2)for(const offset of [0,8,128,136])this.font[0x300+offset+i]=0;}
   else for(let i=0;i<8;i+=4)for(const offset of [0,8,128,136])this.font[0x300+offset+i]=g.randomByte();
   g.bonusFlash--;
  }
 }
 tile(code,characterBase,repeat=false){
  const output=new Uint8Array(256),base=characterBase??D.tileCharacters[code];
  for(let y=0;y<16;y++)for(let x=0;x<16;x++){
   const character=(base+(repeat?0:(y>=8?16:0)+(x>=8?1:0)))&255;
   const bits=this.font[(character&127)*8+(y&7)],color=bits>>(6-((x&7)>>1)*2)&3;
   output[y*16+x]=color===0?this.background:color===3?this.g.colors[character&128?3:2]:this.g.colors[color-1];
  }
  return output;
 }
}
root.BoulderRaster=Raster;
})(globalThis);
