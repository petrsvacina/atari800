/* Character/sprite raster and pixel collision feedback, independent of DOM. */
(function(root){'use strict';
const BANDS=[[28,0,4],[36,48,6],[44,48,6],[52,48,6],[60,48,6],[68,72,6],[78,96,6],[86,120,6],[94,120,6],[102,120,6],[110,144,6],[120,168,6],[128,192,6],[136,192,6],[144,192,6],[152,192,6],[160,216,4]];
const reverse=n=>{n=(n>>4)|(n<<4)&255;n=((n&0xcc)>>2)|((n&0x33)<<2);return ((n&0xaa)>>1)|((n&0x55)<<1);};
function background(game){const s=game.s,a=game.assets,pf=new Uint8Array(384*240),out=new Uint8Array(384*240);
 const water=s.room===a.lastRooms[s.level]||s.room>=10,waterColor=water?[0x84,0x54,0x24,0xc4][s.level&3]:0;
 const wall=(s.wallColors[1]===s.wallColors[0]||(s.wallColors[1]&0xf0)===0x40)?s.wallColors[1]:8;
 for(const [physical,offset,mode] of BANDS){const y0=physical-8,count=mode===4?48:24;
  for(let yy=0;yy<8;yy++){
   const y=y0+yy;let ground=physical<74?s.wallColors[2]:physical<116?s.wallColors[1]:s.wallColors[0];
   if(physical===28&&yy>=4)ground=(s.wallColors[0]|8)-(yy-4)*2;
   if(physical===160)ground=s.wallColors[0]+Math.max(1,yy)*2;
   const colors=[s.flash,waterColor,0x1e,ground,wall];
   for(let c=0;c<count;c++){const ch=s.tiles[offset+c],bits=a.roomFont[(ch&63)*8+yy]||0;
    if(mode===6){const index=(ch>>6)+1;for(let bit=0;bit<8;bit++){const x=c*16+bit*2,on=bits&(128>>bit),p=y*384+x;pf[p]=pf[p+1]=on?index:0;out[p]=out[p+1]=colors[on?index:0]&254;}}
    else{for(let bit=0;bit<4;bit++){let index=(bits>>(6-bit*2))&3;if(index===3)index=ch&128?4:3;const x=c*8+bit*2,p=y*384+x;pf[p]=pf[p+1]=index;out[p]=out[p+1]=colors[index]&254;}}
   }
  }
 }
 return {pf,out};
}
function drawSprites(game,scene,feedback=false){const s=game.s,p=game.picture;if(!p)return;
 const planes=Array.from({length:3},()=>new Uint8Array(384*240));
 const colors=Array.from({length:3},()=>new Uint8Array(384*240));
 function line(value,rawX,physical,plane,color,flip=false){if(rawX<32||rawX>=0xc3)return;const x0=(rawX-32)*2,y=physical-8;if(y<0||y>=240)return;if(flip)value=reverse(value);for(let bit=0;bit<8;bit++)if(value&(128>>bit))for(let dx=0;dx<2;dx++){const x=x0+bit*2+dx;if(x<0||x>=384)continue;const at=y*384+x;planes[plane][at]=1;colors[plane][at]=(color||0)&254;}}
 function bitmap(bits,rawX,physical,plane,palette,flip=false){
  for(let row=0;row<bits.length;row++)line(bits[row],rawX,physical+row,plane,palette[row],flip);
 }
 bitmap(p.hero,p.heroX,p.heroY,0,[p.heroColors[0],...p.heroColors],p.reverse);
 const rows=[new Uint8Array(256),new Uint8Array(256)],inks=[new Uint8Array(256),new Uint8Array(256)];
 // One original player is reused three times down the screen. Bitmap writes
 // can overlap vertically; a scanline then uses that band's horizontal position.
 for(let i=2;i>=0;i--){for(const [which,n,visible] of [[0,p.effects[i],s.bombX[i]!==0x93&&s.bombX[i]!==0x92],[1,p.enemies[i],s.enemyY[i]!==50]])if(visible){for(let j=0;j<n.bits.length;j++){rows[which][n.y+j]=n.bits[j];inks[which][n.y+j]=n.colors[j+2]||0;}}}
 for(let y=28;y<168;y++){const i=y<76?2:y<118?1:0;line(rows[0][y],p.effects[i].x,y,1,inks[0][y]);if(s.enemyY[i]!==50)line(rows[1][y],p.enemies[i].x,y,2,inks[1][y]);}
 const contacts=[0,0,0],hits=[0,0,0];let ghost=0,beamWall=0,upper=0,middle=0,lower=0,beamCollision=0;
 const beamY=p.beam.y-8,beamX=(p.beam.x-32)*2;
 for(let at=0;at<scene.out.length;at++){
  const y=(at/384)|0,physical=y+8,band=physical<77?2:physical<120?1:0;
  if(planes[0][at]&&planes[2][at])contacts[band]=128;
  if(band===0&&planes[0][at]&&planes[1][at])ghost=128;
  if(planes[0][at]&&scene.pf[at]){const mask=1<<((scene.pf[at]-1)&3);if(physical<75)upper|=mask;else if(physical>=77&&physical<118)middle|=mask;else if(physical>=120)lower|=mask;}
  let missile=false;if(p.beam.x&&y===beamY){const x=at%384;missile=x>=beamX&&x<beamX+p.beam.width*2;}
  if(missile){if(planes[2][at])hits[band]=128;if(scene.pf[at]){beamCollision=1;if(scene.pf[at]===4)beamWall=128;}}
  if(!scene.pf[at]){if(planes[0][at])scene.out[at]=colors[0][at];else if(missile)scene.out[at]=colors[0][at]||game.assets.heroColors[6]&254;else if(planes[1][at])scene.out[at]=colors[1][at];else if(planes[2][at])scene.out[at]=colors[2][at];}
 }
 if(feedback){s.contact.set(contacts);s.shotHit.set(hits);s.ghostContact=ghost;s.beamWallHit=beamWall;s.playerUpper=upper;s.playerMiddle=middle;s.playerLower=lower;if(beamCollision)s.laserPhase=0;}
}
function hud(game){const s=game.s,a=game.assets,t=new Uint8Array(128);t.set(a.hudLabels.slice(0,7),2);t.set(a.hudLabels.slice(7,14),98);
 t.fill(0x1a,8,29);const whole=s.power>>2;if(whole){for(let y=whole;y>=0;y--)t[8+y]=0x1e;}if(s.power)t[8+whole]=0x1a+(s.power>=0x50?3:s.power&3);
 for(let y=s.lives-1;y>0;y--){t[33+y]=0x9f;t[65+y]=0x20;}
 for(let x=5,y=s.bombs;y>0&&x>=0;y--,x--){t[55+x]=0x21;t[87+x]=0x22;}
 function number(n,offset,force=false){const digits=String(n);let used=force;for(let i=0;i<2;i++){const d=i===0?(n/10|0):n%10;let c=d||used?16+d:0;t[offset+i*2]=c;t[offset+i*2+1]=c?c+21:0;if(c)used=true;}}
 number(game.difficulty+1,46);
 if(game.endless||game.difficulty===4){t[105]=0;t[106]=13;t[107]=14;t[108]=15;}else number(s.hudLevel+1,105);
 const score=String(game.score).padStart(6,'0');let force=false;for(let i=0;i<3;i++){const n=Number(score.slice(i*2,i*2+2));number(n,113+i*4,i===2||force);if(n)force=true;}
 if(game.maxScore)t.fill(0x2f,113,125);
 return t;
}
function indexed(game){const scene=background(game),a=game.assets;drawSprites(game,scene);
 for(let y=159;y<207;y++)scene.out.fill(2,y*384+24,y*384+360);
 const t=hud(game);for(let row=0;row<4;row++)for(let col=0;col<32;col++){const ch=t[row*32+col];for(let y=0;y<8;y++){const bits=a.hudFont[(ch&127)*8+y]||0;for(let x=0;x<4;x++){let index=(bits>>(6-x*2))&3;if(index===3)index=ch&128?4:3;const code=[2,0x44,0x1e,0x0e,0x86][index],at=(164+row*8+y)*384+64+col*8+x*2;scene.out[at]=scene.out[at+1]=code;}}}
 // Bottom title strip uses the original character bitmap.
 for(let y=0;y<7;y++){const color=a.logoColors[6-y]&254;scene.out.fill(color,(208+y)*384+72,(208+y)*384+116-y*2+16);}
 for(let col=0;col<24;col++){const ch=a.logoText[col];for(let y=0;y<8;y++){const bits=a.logoFont[(ch&63)*8+y]||0;for(let x=0;x<8;x++)if(bits&(128>>x)){const at=(208+y)*384+col*16+x*2;scene.out[at]=scene.out[at+1]=0x0c;}}}
 return scene.out;
}
function color(code){if(root.HERO_PALETTE&&root.HERO_PALETTE[code])return root.HERO_PALETTE[code];const l=code&15,h=[0,45,25,9,345,315,280,250,215,190,172,151,129,109,88,65][code>>4]/60,v=Math.min(255,l*18),c=code>>4?v*.8:0,x=c*(1-Math.abs(h%2-1)),m=v-c;const rgb=h<1?[c,x,0]:h<2?[x,c,0]:h<3?[0,c,x]:h<4?[0,x,c]:h<5?[x,0,c]:[c,0,x];return rgb.map(n=>Math.round(n+m));}
function render(game){const pixels=indexed(game),out=new Uint8ClampedArray(336*240*4),palette=Array.from({length:256},(_,i)=>color(i));for(let y=0;y<240;y++)for(let x=0;x<336;x++){const c=palette[pixels[y*384+x+24]],at=(y*336+x)*4;out[at]=c[0];out[at+1]=c[1];out[at+2]=c[2];out[at+3]=255;}return out;}
function collide(game){const scene=background(game);drawSprites(game,scene,true);}
root.HeroRaster={indexed,render,collide,background,color,hud};
})(globalThis);
