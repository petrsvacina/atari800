/* Native translations of the supplied disk's gate ($B948, scene 2) and
 * hawk ($A806/$A8F9, scene 3). Campaign integration is separate. */
(function(root){'use strict';
const {byte}=root.KaratekaMotion;
class Gate{
 constructor(){this.y=116;this.velocity=0;this.acceleration=0;this.wait=0;}
 tick(g){
  const h=g.hero;let move=false;
  if(this.wait){this.wait=byte(this.wait-1);if(!this.wait)this.velocity=255;}
  else if(this.acceleration||this.velocity)move=true;
  else if(h.x>=30&&h.x<34&&g.heroAlive||h.x>=29&&!g.enemyAlive&&(h.legFrame===2||g.activePose===22)){this.acceleration=3;move=true;}
  if(move){
   if(this.acceleration||this.velocity<128){const twice=this.acceleration*2;this.velocity=byte((twice&255)+this.velocity+(twice>255?1:0));this.acceleration=byte(this.acceleration+1);}
   const y=byte(this.y+this.velocity);
   if(y<116){this.velocity=0;this.y=116;}
   else if(y>=160){this.velocity=this.acceleration=0;this.wait=20;g.cue=1;g.enemyImpact=1;this.y=160;}
   else this.y=y;
  }
  if(this.acceleration&&this.y>=130&&h.x>=31&&h.x<34){
   g.heroAlive=0;g.motion.heroX=h.x;g.motion.command(h,198);g.motion.advance(h);g.motion.advance(h);g.cue=1;g.activePose=h.legs;h.x=33;
   g.health=g.health<3?1:2;g.restore=0;g.restoreDelay=4;return true;
  }
  return false;
 }
}
const heights=[108,121,130,108];
class Hawk{
 constructor(){Object.assign(this,{delay:5,x:80,nextDelay:16,y:108,dx:80,frame:0,turn:0,active:1,passes:2,maxPasses:2});}
 spawn(g){this.x=(g.shift&1)+41;this.y=heights[g.random&3];this.dx=254;this.frame=this.turn=0;this.passes=this.maxPasses;if(this.nextDelay!==9)this.nextDelay=byte(this.nextDelay-1);}
 hold(g,frames){g.hold=frames;g.holdRequested=1;}
 finish(g){this.delay=30;g.recovery=25;}
 tick(g){
  if(this.delay)return;const h=g.hero;
  if(this.frame>=12){if(this.frame<14)this.frame++;else{this.active=0;g.redraw=2;this.finish(g);}return;}
  if(!g.enemyAlive){this.x=byte(this.x-1);this.frame=12;return;}
  if(this.turn){this.dx=4;this.x=byte(this.x+4);this.turn=0;}
  else{
   this.x=byte(this.x+this.dx);
   if(byte(h.x+5)>=this.x&&this.dx>=128){
    const inWindow=byte(h.x+2)<this.x;
    const striking=h.legs===22||h.legs>=2&&h.legs<5;
    if(inWindow&&striking&&heights[byte(h.height+1)]===this.y){
     g.flash=1;this.turn=1;g.enemyImpact=1;this.hold(g,6);if(g.enemyHealth){g.enemyRestore=0;g.enemyHealth--;if(!g.enemyHealth)g.enemyAlive=0;}if(!g.enemyAlive)this.hold(g,30);
    }else if(byte(h.x+1)>=this.x){
     this.hold(g,4);g.heroImpact=2;g.flash=2;this.x=byte(this.x+2);if(!g.heroAlive)this.passes=1;this.passes=byte(this.passes-1);if(!this.passes)this.turn=1;
    }
   }
  }
  if(this.passes<this.maxPasses&&this.dx>=128)this.hold(g,5);
  if(this.x>=44){if(g.heroAlive)this.delay=1;else this.finish(g);}
 }
 animate(g){
  if(this.delay||this.frame>=12)return;
  let phase=this.frame+1;
  if(this.dx>=128&&!g.distant&&byte(g.hero.x+7)>=this.x)phase=phase<4?3:phase<6?phase:4;
  else if(phase>=3)phase=0;
  this.frame=phase;
 }
}
class PalaceHawk extends Hawk{
 resetDelay(g,carry=1){this.delay=byte((g.random&31)+this.nextDelay+carry+(g.flash===1?50:0));}
 spawn(g){if(byte(g.enemyX-g.hero.x)<20){this.delay=byte(this.delay+1);return;}super.spawn(g);}
 tick(g){
  if(this.delay)return;g.redraw=2;const h=g.hero;
  if(this.turn){this.dx=2;this.x=byte(this.x+4);this.turn=0;}
  else{this.x=byte(this.x+this.dx);
   if(byte(h.x+5)>=this.x&&this.dx>=128){
    if(byte(h.x+2)<this.x&&(h.legs===22||h.legs>=2&&h.legs<5)&&heights[byte(h.height+1)]===this.y){g.flash=this.turn=g.enemyImpact=1;this.hold(g,6);}
    else if(byte(h.x+1)>=this.x){this.hold(g,4);g.heroImpact=g.flash=2;this.x=byte(this.x+2);if(!g.heroAlive)this.passes=1;this.passes=byte(this.passes-1);if(!this.passes)this.turn=1;}
   }
  }
  if(this.passes<this.maxPasses&&this.dx>=128)this.hold(g,5);
  if(this.x>=44){this.resetDelay(g);g.recovery=25;}
 }
}
root.KaratekaHazards={Gate,Hawk,PalaceHawk};
})(globalThis);
