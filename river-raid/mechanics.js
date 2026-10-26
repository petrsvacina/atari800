/* Direct native translation of the original foreground combat routines.
 * Addresses in comments identify the development reference, not runtime code. */
(function(root){
'use strict';
function updateCombat(s,randomByte,a){
 const tick=s.tick&255,t=s.tank,active=s.demo||s.playing;
 // A1FF: RANDOM chooses one of the eleven hardware slots, including blanks.
 if(!(tick&15)){let slot=randomByte&15;if(slot>=11)slot-=5;if(slot!==s.nearest)s.actors[slot].flags|=64;}
 // A21B: animation and translation share the original tank clock.
 if(!(tick&(t.frame>=4&&t.frame<8?3:15))){
  if(t.phase>=128&&active){
   let move=!s.bridgeDestroyed;
   if(t.follow&128){move=false;if(t.rawY>=26){if(t.bankCollision)t.phase=(t.phase+1)&255;else move=true;}}
   if(move)t.rawX=(t.rawX+((t.frame&127)<6?1:-1))&255;
  }
  t.frame=t.frame&128?3:a.tankCycle[t.frame];
 }
 // A271: exploding actors retain their slot, original size and colour table.
 for(let slot=s.first;slot<11;slot++){
  const e=s.actors[slot];let frame=e.frame;
  if(frame>=14)continue;
  if(frame<12&&!(tick&(frame<7?7:1)))frame=e.frame=a.actorCycle[frame];
  if(!active||(s.stage>>1)===0||frame<7)continue;
  if(frame!==7){
   if(frame===12&&(tick&2))continue;
   if((slot^tick^s.flip)&1||!(e.flags&64))continue;
   if(e.flags&1){if(!(e.flags&16))e.flags^=24;}else e.flags&=239;
  }
  if(e.flags&8){e.rawX=(e.rawX-1)&255;if(e.rawX<44)e.rawX=212;}
  else{e.rawX=(e.rawX+1)&255;if(e.rawX>=213)e.rawX=44;}
 }
}
function updateTankShot(t,playing,a){
 // A607: a moving beam, then five stationary explosion pictures; repeat.
 let picture=0;
 if(t.phase>=128){t.picture=0;return;}
 if(t.phase===0){
  if(t.rawY<25){t.picture=0;return;}
  t.shotY=(t.rawY-6)&255;t.fraction=0;t.shotX=(t.rawX+(t.frame<6?4:-4))&255;picture=1;
 }else if(t.phase<17){
  const y=t.shotY+a.shotFall[t.phase];t.shotY=y&255;
  if(t.frame<6){const f=t.fraction+t.fractionDX;t.fraction=f&255;t.shotX=(t.shotX+t.dx+(f>255?1:0))&255;}
  else{const f=t.fraction-t.fractionDX;t.fraction=f&255;t.shotX=(t.shotX-t.dx-(f<0?1:0))&255;}
  picture=1;
 }else picture=((t.phase-17)>>3)+2;
 t.phase++;
 if(t.phase===57){t.phase=playing?0:255;picture=0;}
 t.picture=picture;
}
function tankBonus(t,bridgeX,bridgeNumber){
 // A500: the interval is deliberately asymmetric, as in the original.
 if(((bridgeX-8)&255)<t.rawX&&((bridgeX+31)&255)>=t.rawX){t.frame|=128;return true;}
 if(bridgeNumber>=5){const d=t.frame<6?(bridgeX-t.rawX)&255:(t.rawX-bridgeX)&255;if(d<(t.frame<6?41:65))t.phase=(t.phase+1)&255;}
 return false;
}
function updateGunner(s,e,playing){
 // A5B7: one horizontal missile, carried vertically by generated river rows.
 if(!e||e.frame<10||e.frame>11){s.rawX=0;return false;}
 if(s.rawX){s.rawX=s.bankCollision?0:(s.rawX+s.dx)&255;return false;}
 if(!playing)return false;
 const y=(e.rawY-60)&255;if(y<28)return false;
 s.rawY=y;s.dx=e.flags&8?-2:2;s.rawX=(e.rawX+(e.flags&8?-3:7))&255;return true;
}
function actorPicture(a,e){
 const type=e.type,height=a.sprites[type].height;
 return{bits:a.mechanics.actorFrames[e.frame][e.flags&8?1:0].slice(0,height).reverse(),colors:a.sprites[type].variants[0].colors};
}
root.RiverMechanics={updateCombat,updateTankShot,tankBonus,actorPicture,updateGunner};
})(globalThis);
