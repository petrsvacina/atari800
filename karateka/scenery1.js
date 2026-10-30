/* Native scene-1 scenery, original compositors $AD00/$AD03/$AD06/$B090/$BC00.
 * It redraws a complete bitmap instead of repairing two old software buffers. */
(function(root){'use strict';const byte=n=>n&255;
class Scenery1{
 constructor(data=root.KARATEKA_SCENE1){this.data=data;}
 put(b,p,x,y,shift=0,mode=1,mirror=false,right=false){const a=this.data.art[p];if(!a)throw Error('Missing original scenery '+p.toString(16));b.blit(a,byte(x),byte(y),shift,mode,mirror,right);return {p,x,y,shift,mode,mirror,right};}
 table(kind,index){const t=this.data.tables;return {p:t[kind+'Low'][index]+256*t[kind+'High'][index],x:t[kind+'X'][index],y:t[kind+'Y'][index]};}
 paint(b,s){
  b.clear();b.rectangle(0,35,40,104,170);b.rectangle(0,153,40,181,85);b.rectangle(0,111,40,153,0);b.rectangle(0,181,40,188,0);
  for(let x=0;x<40;x+=2)this.put(b,0xaa11,x,104);
  this.put(b,0xa948,18,81);this.put(b,0xa976,16,92);
  this.clouds(b,s);if(!s.side)this.castle(b,s);if(!s.room)this.cliff(b,s);if(s.side)this.gate(b,s);
 }
 clouds(b,s){this.put(b,0xa9b8,15,100);this.put(b,0xa9e2,12,108);let shift=s.shift+1,x=s.cloud;if(shift>=8){shift=0;x=byte(x+1);}x=byte(x+1);
  for(let i=0;i<4;i++){this.put(b,0xaa23,x,100,shift,1,x>=21&&x<128);x=byte(x+12);if(x>=40)x=byte(x-48);}
 }
 castlePart(b,s,index){const a=this.table('castle',index),mirror=s.offset<20||s.offset>=128,x=byte(s.offset+(mirror?-a.x:a.x));return this.put(b,a.p,x,a.y,s.shift,1,mirror,mirror);}
 repeat(b,a,until){do{a.y+=2;this.put(b,a.p,a.x,a.y,a.shift,a.mode,a.mirror,a.right);}while(a.y<until);}
 castle(b,s){if(s.offset>=41&&s.offset<254)return;for(const i of [5,8,9,10,11,12])this.castlePart(b,s,i);this.repeat(b,this.castlePart(b,s,13),102);for(const i of [14,15])this.castlePart(b,s,i);
  this.repeat(b,this.castlePart(b,s,1),151);for(const i of [2,3,4,6])this.castlePart(b,s,i);this.repeat(b,this.castlePart(b,s,7),102);this.castlePart(b,s,17);
 }
 cliffPart(b,index,offset,shift=0,mode=1){const a=this.table('cliff',index);return this.put(b,a.p,byte(a.x+offset),a.y,shift,mode);}
 cliff(b,s){if(s.offset<35)return;if(s.offset>=46)b.rectangle(0,100,1,105,170);
  this.cliffPart(b,1,0);let offset=byte(s.offset-48),phase=byte(s.shift-1);if(phase>=128){offset=byte(offset-1);phase=7;}
  let end=byte(11+offset);
  if(end&&end<128){b.rectangle(0,116,end,152,170,0);let edge=byte(7+offset);if(edge&&edge<128)b.rectangle(0,152,edge,181,0,170);b.rectangle(0,104,end,113,170);}
  for(const i of [0,2])this.cliffPart(b,i,offset,phase);this.repeat(b,this.cliffPart(b,3,offset,phase),151);this.cliffPart(b,4,offset,phase,255);
 }
 gatePart(b,s,index){const a=this.table('gate',index);return this.put(b,a.p,byte(a.x+s.offset),a.y,s.shift);}
 gate(b,s){if(s.offset>=40)return;for(let i=1;i<8;i++)this.gatePart(b,s,i);this.gatePart(b,s,11);this.repeat(b,this.gatePart(b,s,10),149);for(const i of [13,14,15,16])this.gatePart(b,s,i);}
 foreground(b,s){if(!s.side){if(s.offset>=41&&s.offset<244)return;this.repeat(b,this.castlePart(b,s,0),170);}else if(s.offset<41){this.repeat(b,this.gatePart(b,s,0),147);this.gatePart(b,s,12);}}
 climb(b,frame){const a=this.data.climb[frame];if(a)this.put(b,a.pointer,a.x,a.y);}
 fall(b,s,frame){const a=this.data.fall[frame];if(!a)return;let x=byte(a.x+s.offset-48),shift=byte(s.shift-1);if(shift>=128){x=byte(x-1);shift=7;}this.put(b,a.pointer,x,a.y,shift);}
}
root.KaratekaScenery1=Scenery1;
})(globalThis);
