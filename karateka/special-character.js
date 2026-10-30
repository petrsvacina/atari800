/* Native composition of extracted final-opponent pixel masks. */
(function(root){'use strict';
class SpecialCharacter{
 constructor(data=root.KARATEKA_SPECIAL_CHARACTER){this.data=data;this.decoded=new Map();}
 lowerMask(b,f,shift=0){const d=root.KARATEKA_SPECIAL_MASK,t=d.tables,l=f.legs,a=d.art[t.low[l]+256*t.high[l]];if(a)b.blit(a,(f.x-t.x[l])&255,(114+t.y[l])&255,shift,255,!t.flip[l],true);}
 draw(b,f,shift=0){
  const index=this.data.mapping[(f.legs*38+f.torso)*8+(shift&7)];if(index===undefined||index<0)throw Error('Unverified final-opponent pose '+f.legs+','+f.torso);
  const a=this.data.frames[index];let p=this.decoded.get(index);if(!p){const raw=atob(a.data);p=new Uint8Array(a.width*a.height);for(let i=0;i<p.length;i++)p[i]=raw.charCodeAt(i>>1)>>(i&1?0:4)&15;this.decoded.set(index,p);}
  const x=(f.x>=128?f.x-256:f.x)*4+a.x;
  for(let row=0;row<a.height;row++)for(let col=0;col<a.width;col++){const xx=x+col,yy=a.y+row;if(xx<0||xx>=160||yy<0||yy>=153)continue;const q=p[row*a.width+col],at=yy*160+xx;b.pixels[at]=(q>>2)|(b.pixels[at]&(q&3));}
  f.drawX=(f.x+a.drawDelta)&255;
 }
}
root.KaratekaSpecialCharacter=SpecialCharacter;
})(globalThis);
