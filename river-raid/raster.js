/* Indexed original river and bitmap silhouettes, independent of the DOM. */
(function(root){'use strict';
const terrain=[[0,0,0],[0,128,0],[0,0,0],[0,42,174]];
function color(code){const hue=code>>4,lum=code&15;if(!lum)return[0,0,0];if(hue===0)return[lum*17,lum*16,Math.min(255,lum*18)];if(code===0x1e)return[246,255,146];if(code===0x8e)return[148,202,255];const h=[0,50,24,5,335,310,275,245,215,192,170,150,125,108,85,65][hue]/60,v=Math.min(255,lum*20+8),c=v*.86,x=c*(1-Math.abs(h%2-1)),m=v-c;let rgb=h<1?[c,x,0]:h<2?[x,c,0]:h<3?[0,c,x]:h<4?[0,x,c]:h<5?[x,0,c]:[c,0,x];return rgb.map(n=>Math.round(n+m));}
function render(game){
 const a=game.assets,w=320,h=192,out=new Uint8ClampedArray(w*h*4);for(let i=3;i<out.length;i+=4)out[i]=255;
 const dot=(x,y,c)=>{if(x<0||x>=320||y<0||y>=192)return;const i=(Math.floor(y)*w+Math.floor(x))*4;out[i]=c[0];out[i+1]=c[1];out[i+2]=c[2];};
 for(let y=0;y<160;y++){const row=game.course.row(Math.floor(159+game.scroll-y));if(!row)continue;for(let byte=0;byte<40;byte++)for(let p=0;p<4;p++){const c=terrain[row[byte]>>(6-p*2)&3];dot(byte*8+p*2,y,c);dot(byte*8+p*2+1,y,c);}}
 function bitmap(bits,x,y,scale,colors){for(let yy=0;yy<bits.length;yy++){const c=Array.isArray(colors)?colors:color(colors[yy]);for(let xx=0;xx<8;xx++)if(bits[yy]&(128>>xx))for(let s=0;s<scale;s++)dot(Math.floor(x+xx*scale+s),Math.floor(y+yy),c);}}
 for(const e of game.enemies){if(e.dead)continue;const s=a.sprites[e.type],v=s.variants[e.flags&8?1:0],frame=e.frame?spriteFrame(e):v;bitmap(frame.bits,e.x,game.screenY(e),s.width/8*2,{...frame.colors});}
 function spriteFrame(e){return a.sprites[e.frame].variants[e.flags&8?1:0];}
 if(game.phase!=='crash'&&game.phase!=='over')bitmap(a.planes[game.player.pose],(game.player.rawX-48)*2,145,2,game.playerIndex?[140,200,255]:[246,255,146]);
 if(game.bullet)for(let y=0;y<8;y++){dot(game.bullet.x,game.bullet.y+y,[246,255,180]);dot(game.bullet.x+1,game.bullet.y+y,[246,255,180]);}
 for(const s of game.shells){dot(s.x,s.y,[255,220,150]);dot(s.x+1,s.y,[255,220,150]);}
 for(const e of game.explosions){const frame=a.sprites[Math.min(6,2+Math.floor(e.age/7))].variants[0];bitmap(frame.bits,e.x-8,e.y-3,2,[255,Math.max(50,230-e.age*5),140]);}
 for(let y=160;y<192;y++)for(let x=0;x<320;x++)dot(x,y,[91,87,100]);
 function text(s,x,y,c=[242,255,156]){for(const ch of String(s).toUpperCase()){const code=ch===' '?0:ch>='0'&&ch<='9'?16+Number(ch):ch.charCodeAt(0)-32;const bits=a.glyphs[code]||a.glyphs[0];bitmap(bits,x,y,2,c);x+=16;}}
 text('P'+(game.playerIndex+1),16,161);text(String(game.score).padStart(6,'0'),64,161);text('HI',176,161,[0,0,0]);text(String(game.best).padStart(6,'0'),224,161);
 text('GAME',16,173,[0,0,0]);text(game.mode==='two'?'2':'1',80,182,[0,0,0]);text('BRIDGE',176,173);text(String(game.bridge).padStart(3,'0'),272,182);
 for(let y=173;y<189;y++)for(let x=86;x<169;x++)dot(x,y,[0,0,0]);text('E',90,181);text('F',151,181);const fuelX=100+Math.round(game.fuel/65535*46);for(let y=175;y<188;y++){dot(fuelX,y,game.fuel<16384&&game.tick%30<15?[255,110,100]:[246,255,146]);dot(fuelX+1,y,[246,255,146]);}for(let y=173;y<189;y++){dot(86,y,[167,183,164]);dot(168,y,[167,183,164]);}
 // Reserve jets occupy the strip below the playfield and are also exposed in the UI.
 for(let i=0;i<Math.max(0,game.lives-1);i++){const x=180+i*9;for(let yy=0;yy<5;yy++)for(let xx=0;xx<7;xx++)if((yy===2||xx===3)&&yy<4)dot(x+xx,185+yy,[242,255,156]);}
 return out;
}
root.RiverRaster={render,color};})(globalThis);
