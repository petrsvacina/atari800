/* Karateka's original character composition ($6815), native bitmap operations.
 * Sprite selection and geometry are data; CPU instructions are not present. */
(function(root){'use strict';
const byte=n=>n&255;
class Characters{
 constructor(data=root.KARATEKA_ART){this.data=data;}
 pointer(low,high,index){const t=this.data.tables;return t[high][index]?t[low][index]+256*t[high][index]:0;}
 put(bitmap,pointer,x,y,shift,mode,mirror=false,right=false){if(!pointer)return;const art=this.data.art[pointer];if(!art)throw Error('Missing original bitmap '+pointer.toString(16));bitmap.blit(art,byte(x),byte(y),shift,mode,mirror,right);}
 lowerMask(bitmap,f,shift=0){const t=this.data.tables,l=f.legs,dir=f.facing>=128?-1:1;const x=byte(f.x+dir*(t.legX[l]+t.legMaskX[l]));const p=this.pointer('legMaskLow','legMaskHigh',l);this.put(bitmap,p,x,114+t.legMaskY[l],shift,255,(dir<0)!==!!t.mirroredLeg[l],dir<0);}
 draw(bitmap,f,shift=0,style=0,alternateHead=false){
  const t=this.data.tables,l=f.legs,u=f.torso,dir=f.facing>=128?-1:1,mirror=dir<0;
  const legX=byte(f.x+dir*t.legX[l]);let bodyX=byte(f.x+dir*t.bodyX[l]),phase=byte(shift+dir*t.bodyPhase[l]);
  if(mirror&&phase>=128){phase=byte(phase+8);bodyX=byte(bodyX-1);}else if(!mirror&&phase>=8){phase-=8;bodyX=byte(bodyX+1);}
  const baseX=bodyX,basePhase=phase;
  if(u===6||u>=20&&u<30)this.put(bitmap,0x9a2a,bodyX+dir,129,phase,255,mirror,mirror);
  else if(u===7||u===39||u>=10&&u<14)this.put(bitmap,0x9a18,bodyX,136,phase,255,mirror,mirror);
  this.put(bitmap,this.pointer('legLow','legHigh',l),legX,114+t.legY[l],shift,0,mirror!==!!t.mirroredLeg[l],mirror);
  const form=t.headForm[u],variant=form>=8?form-7:0;
  if(form<8){phase=byte(phase+dir*form);if(mirror&&phase>=128){phase=byte(phase+8);bodyX=byte(bodyX-1);}else if(!mirror&&phase>=8){phase-=8;bodyX=byte(bodyX+1);}}
  let headX=byte(bodyX+dir*t.headX[u]),headY=byte(114+t.headY[u]);
  this.put(bitmap,this.pointer('headMaskLow','headMaskHigh',variant),headX,headY,phase,255,mirror,mirror);
  let head;
  if(!alternateHead&&!mirror)head=this.pointer('heroHeadLow','heroHeadHigh',variant);
  else{headX=byte(headX-dir);headY=byte(headY-2);head=this.data.heads[style][variant];}
  this.put(bitmap,head,headX,headY,phase,0,mirror,mirror);
  this.put(bitmap,this.pointer('armLow','armHigh',u),baseX+dir*t.armX[u],114+t.armY[u],basePhase,0,mirror,mirror);
  f.drawX=baseX;
 }
}
root.KaratekaCharacters=Characters;
})(globalThis);
