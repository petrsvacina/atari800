/* Native 160x153 bitmap composition and the original split NTSC display list. */
(function(root){'use strict';
const black=[6,6,6],pink=[228,137,144],white=[226,226,226],sky=[94,181,255],grey=[134,134,134],blue=[67,135,253],dimPink=[202,108,122];
class Renderer{
 constructor(){this.bitmap=new root.KaratekaBitmap();this.characters=new root.KaratekaCharacters();this.special=new root.KaratekaSpecialCharacter();this.scenes=[null,new root.KaratekaScenery1(),new root.KaratekaScenery2(),new root.KaratekaRooms()];this.presentation=new root.KaratekaPresentation();this.ending=new Map();this.rgba=new Uint8ClampedArray(320*240*4);}
 decode(s){const raw=atob(s),out=new Uint8Array(160*153);for(let i=0;i<raw.length;i++)for(let j=0;j<4;j++)out[i*4+j]=raw.charCodeAt(i)>>(6-j*2)&3;return out;}
 background(g){const c=g.camera,s={scene:c.scene,room:c.room,shift:c.shift,offset:c.offset,cloud:c.cloud,side:g.playerSide,gateY:g.gate?.y,door:g.door,extraDoor:g.extraDoor};
  if(c.scene===4&&c.room===6){if(!this.ending.has(g.marikoPose)){const raw=root.KARATEKA_ENDING.frames[g.marikoPose];if(!raw)throw Error('Unknown original ending pose '+g.marikoPose);this.ending.set(g.marikoPose,this.decode(raw));}this.bitmap.pixels.set(this.ending.get(g.marikoPose));}
  else this.scenes[Math.min(c.scene,3)].paint(this.bitmap,s);return s;
 }
 visibleEnemy(g){if(g.arrivalShot)return true;const e=g.enemy,c=g.camera;if(e.x>=46&&e.x<252)return false;if(c.scene===1){if(g.enemySide!==g.playerSide&&c.offset<49)return false;if(!c.room&&e.x>=128)return false;}return true;}
 health(g){const b=this.bitmap;b.rectangle(0,181,40,188,0);if(g.camera.scene===4&&g.kind===2)return;const buffer=g.buffer^96;
  if(g.health[0]&&(g.health[0]>=3||buffer!==32)){let x=0,phase=1;for(let i=0;i<g.health[0];i++){b.blit(root.KARATEKA_ART.art[0xb12],x,181,phase,1,true);phase+=2;if(phase>=8){phase-=8;x++;}x++;}}
  if(g.health[1]&&(g.health[1]>=3||buffer!==32)){let x=38,phase=6;for(let i=0;i<g.health[1];i++){b.blit(root.KARATEKA_ART.art[0xb1c],x,181,phase,1);phase-=2;if(phase<0){phase+=8;x--;}x--;}}
 }
 compose(g){
  const s=this.background(g),b=this.bitmap,c=g.camera,heroVisible=!g.arrivalShot&&!g.climb&&!g.falling&&g.endingState!==2,enemyVisible=this.visibleEnemy(g);
  if(heroVisible)this.characters.lowerMask(b,g.hero,c.shift);if(enemyVisible){if(g.kind&&g.kind!==5)this.special.lowerMask(b,g.enemy,c.shift);else this.characters.lowerMask(b,g.enemy,c.shift);}
  if(!g.arrivalShot)this.presentation.hawk(b,g);
  if(heroVisible)this.characters.draw(b,g.hero,c.shift);
  if(heroVisible&&c.scene===2)this.scenes[2].crushed(b,g);
  if(c.scene===1){for(const n of g.climbFrames||[])this.scenes[1].climb(b,n);for(const n of g.fallFrames||[])this.scenes[1].fall(b,s,n);}
  if(enemyVisible){if(g.kind&&g.kind!==5)this.special.draw(b,g.enemy,c.shift);else this.characters.draw(b,g.enemy,c.shift,Math.min(6,g.guardStyle),true);}
  this.presentation.drawEffects(b,g);this.scenes[Math.min(c.scene,3)].foreground(b,s);this.health(g);return b;
 }
 frame(g,finalText=false){
  g=g.renderState||g;
  const out=this.rgba;for(let i=0;i<out.length;i+=4){out[i]=out[i+1]=out[i+2]=6;out[i+3]=255;}
  const put=(x,y,color)=>{const i=(y*320+x)*4;out[i]=color[0];out[i+1]=color[1];out[i+2]=color[2];};
  if(finalText){const raw=atob(root.KARATEKA_ENDING.finalText);for(let y=0;y<153;y++)for(let x=0;x<320;x++)if(raw.charCodeAt(y*40+(x>>3))>>(7-(x&7))&1)put(x,y+40,white);return out;}
  const b=this.compose(g),selector=g.palette;
  const header=[black,pink,selector===0||selector===1||selector===3?sky:grey,white],main=[black,pink,selector===0?blue:grey,white],status=selector===2?[black,black,black,black]:[black,dimPink,blue,white];
  // Three ANTIC-8 lines reuse the initial 30 bitmap bytes, then LMS restarts
  // the same bitmap in ANTIC-E; seven status rows follow a four-line gap.
  for(let y=0;y<24;y++)for(let x=0;x<320;x++)put(x,y+24,header[b.pixels[Math.floor(y/8)*40+Math.floor(x/8)]]);
  for(let y=0;y<153;y++){const palette=y<82?header:y<146?main:status,yy=y<146?y+48:y+52;for(let x=0;x<160;x++){const color=palette[b.pixels[y*160+x]];put(x*2,yy,color);put(x*2+1,yy,color);}}
  return out;
 }
}
root.KaratekaRenderer=Renderer;
})(globalThis);
