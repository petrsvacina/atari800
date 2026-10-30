/* Original palace background and moving portcullis: $B000/$B100/$B280. */
(function(root){'use strict';const byte=n=>n&255;
class Scenery2{
 constructor(data=root.KARATEKA_SCENE2){this.data=data;}
 put(b,p,x,y,shift=0,mode=1,mirror=false){const a=this.data.art[p];if(!a)throw Error('Missing palace bitmap '+p.toString(16));b.blit(a,byte(x),byte(y),shift,mode,mirror);return {p,x,y,shift,mode,mirror};}
 part(b,s,index,mode=1){const t=this.data.tables;return this.put(b,t.gateLow[index]+256*t.gateHigh[index],byte(s.offset-28+t.gateX[index]),t.gateY[index],s.shift,mode);}
 paint(b,s){
  b.clear();b.rectangle(0,153,40,181,85,0);b.rectangle(0,81,40,90,170);b.rectangle(0,93,40,102,170);b.rectangle(0,80,40,81,255);b.rectangle(0,92,40,93,255);
  this.put(b,0xa592,18,81);this.put(b,0xa5b8,16,93);let x=s.cloud;
  for(let i=0;i<6;i++){this.put(b,0xa4d8,x,80,s.shift,1,x>=21&&x<128);x=byte(x+8);if(x>=40)x=byte(x-48);}
  if(!s.offset||s.offset>=247){this.put(b,0xa602,s.offset,57,s.shift);this.put(b,0xa546,s.offset+8,80,s.shift);}
  if(s.offset&&s.offset<41)for(const i of [10,7,8])this.part(b,s,i);
 }
 foreground(b,s){
  if(!s.offset||s.offset>=40)return;this.part(b,s,9);const a=this.part(b,s,6,0);
  do{this.put(b,a.p,a.x,a.y,a.shift,0);a.y++;}while(a.y<s.gateY);
  let index=0;while(index<5&&s.gateY>=this.data.tables.gateY[index+1])index++;
  const t=this.data.tables;this.put(b,t.gateLow[index]+256*t.gateHigh[index],s.offset+4,s.gateY,s.shift,0);
 }
 crushed(b,g){
  if(g.hero.legs!==19||g.hero.x!==33)return;
  // $BC63 inherits the arm compositor's subpixel phase.
  const phase=(g.camera.shift+root.KARATEKA_ART.tables.bodyPhase[19])&7;
  this.put(b,0xad29,32,152,phase);
  if(g.gate.y<152)this.put(b,g.gate.y<140?0xad40:0xad54,32,160,phase);
 }
}
root.KaratekaScenery2=Scenery2;
})(globalThis);
