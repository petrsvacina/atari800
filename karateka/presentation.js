/* Original impact selection ($74C0) and layered bird drawing ($BD55/$A9FC).
 * Effects are prepared once per game step; drawing is side-effect free. */
(function(root){'use strict';const byte=v=>v&255;
class Presentation{
 constructor(data=root.KARATEKA_PRESENTATION){this.data=data;}
 effects(g){
  const ops=[],spark=(x,y,block=false)=>{ops.push({p:block?0x9490:0x93ab,x:byte(x),y:byte(y),mode:255});ops.push({p:block?0x94e6:0x942a,x:byte(x),y:byte(y+3),mode:0});};
  for(const [f,result] of [[g.enemy,g.results[0]],[g.hero,g.results[1]]]){
   if(g.flash===2){g.flash=0;spark(g.hawk.x-3,g.hawk.y+2);continue;}if(g.flash===1){g.flash=0;spark(g.hawk.x,g.hawk.y+2);continue;}
   const height=byte(f.height+1),x=f.x+(f.facing>=128?-8:4);
   if(result===1){spark(x-([26,29].includes(f.legs)?f.facing:0),this.data.impactY[3+height],true);}
   else if(result===2||result===3){g.hitSound=height+1;spark(x,this.data.impactY[(result===2?0:6)+height]);}
   else if(g.endingState===254)spark(19,123);
  }
  return ops;
 }
 drawEffects(b,g){for(const a of g.renderEffects||[])b.blit(this.data.effects[a.p],a.x,a.y,g.camera.shift,a.mode);}
 hawk(b,g){
  const h=g.hawk;if(!h||h.delay)return;const d=this.data.hawks[g.camera.scene];if(!d)return;const f=h.frame,mirror=h.dx<128;
  const put=(index,y,mode)=>b.blit(d.art[d.low[index]+256*d.high[index]],h.x,byte(y),g.camera.shift,mode,mirror);
  if(f>=12){put(f,h.y-3,0);return;}
  b.blit(d.art[f===1||f===5?0xaca8:0xac8d],h.x,f===1||f===5?157:159,g.camera.shift,255);
  if(g.camera.scene===2)put(f,h.y+d.dy[f],1);
  else{put(f,h.y+d.dy[f],255);put(f+6,h.y+d.dy[f],0);}
 }
}
root.KaratekaPresentation=Presentation;
})(globalThis);
