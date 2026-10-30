/* Native final bank: last opponent, Mariko's recognition/attack and reunion.
 * $B7FA-$BA1C, $B300 camera transitions and $BB84-$BC24. */
(function(root){'use strict';
const {byte,fighter,bytes}=root.KaratekaMotion;
const reunion=[27,27,27,27,27,28,28,28,28,28,29,29,29,30,31,31,31,30,29,28,27];
class Stage4 extends root.KaratekaStage3{
 constructor(seed=7,previous=null){super(seed);this.initFinal(seed,previous);}
 initFinal(seed,previous){
  // $B728/$B72D call the common initializers. The preceding bank's pose,
  // attack, death animation and position do not cross this handover.
  this.hero=fighter([7,7,12,0,0,0,0,0,0,0,255,0,1,0,0,255]);this.enemy=fighter([19,19,20,0,0,0,0,0,0,0,0,0,255,0,0,255]);
  if(previous){for(const side of ['hero','enemy'])for(const field of ['drawX','repeat','spare2'])this[side][field]=previous[side][field];this.camera.offset=previous.camera.offset;this.camera.velocity=previous.camera.velocity;this.extraDoor=previous.extraDoor;}
  else this.camera.offset=224;
  this.camera.room=4;this.camera.shift=0;this.enemySide=this.playerSide=0;this.alive[1]=0;
  this.camera.scene=4;this.camera.cloud=17;this.max=[8,20];this.health=[8,0];this.restoreDelay=[30,30];this.alive[0]=1;this.rules.random=byte(seed);this.rules.data={...root.KARATEKA_MOTION_DATA,aiThresholds:root.KARATEKA_CAMPAIGN.scenes[4].aiThresholds};Object.assign(this.rules,{kickChance:255,punchChance:255,waitChance:255});
  this.guardStyle=6;this.kind=0;this.progress=2;this.marker=1;this.mode='playing';this.palette=4;this.door=0;this.doorThreshold=5;this.hawk.active=0;this.hawk.delay=5;this.hawk.x=this.hawk.dx=80;this.hawk.nextDelay=16;this.endingState=0;this.marikoPose=23;this.marikoStep=0;this.marikoWait=5;this.threat=0;this.entranceMusic=false;this.flash=0;this.climb=0;this.rules.sound=8;
 }
 enemyProbabilities(){if(this.camera?.scene===4)Object.assign(this.rules,{kickChance:255,punchChance:255,waitChance:255});else super.enemyProbabilities();}
 resetHero(){const old=this.hero;this.hero=fighter([7,7,11,old.drawX,old.repeat,0,0,0,0,0,255,0,1,0,old.spare2,255]);}
 spawnBoss(){this.newEnemy();this.alive[1]=1;this.health[1]=this.max[1];this.marker=0;this.guardStyle=byte(this.guardStyle+1);Object.assign(this.enemy,{legs:6,torso:6,running:0,x:40});this.kind=1;}
 cameraTick(){
  const c=this.camera,h=this.hero;Object.assign(c,{heroX:h.x,enemyX:this.enemy.x,hawkX:this.hawk.x});const translate=n=>{c.heroX=byte(c.heroX+n);c.enemyX=byte(c.enemyX+n);c.hawkX=byte(c.hawkX+n);};
  if(h.x>=128||h.x<3){c.room=byte(c.room-1);if(!this.door&&c.room===5){this.marikoPose=36;this.threat=0;}this.door=0;translate(30);}
  else if(h.x>=33){c.room=byte(c.room+1);if(c.room>=this.doorThreshold&&c.room!==6)this.door=5;if(c.room===6&&!this.kind){this.threat=1;this.spawnBoss();c.enemyX=this.enemy.x;}translate(-30);}
  else if(c.room||(c.offset===224&&!c.shift&&h.x>=15)||(!c.offset&&!c.shift&&h.x<15)||h.x===15)c.velocity=0;
  else if(h.x<15)c.left();else c.right(h.running,h.legFrame);
  h.x=c.heroX;this.enemy.x=c.enemyX;this.hawk.x=c.hawkX;
 }
 mariko(){
  if(this.marikoPose<26){const old=this.marikoPose++;if(old===24)this.emit('music',16);return;}
  if(this.marikoWait)return;
  if(this.endingState>=128){this.endingState=byte(this.endingState+1);if(!this.endingState)this.marikoPose=36;return;}
  if(this.endingState===2){this.marikoStep=byte(this.marikoStep+1);this.marikoPose=reunion[this.marikoStep];if(this.marikoStep===11)this.emit('wait',56);return;}
  if(!this.alive[0])return;
  if(this.hero.x>=19){
   if(this.marikoPose!==32){this.endingState=254;this.marikoPose=33;this.hold=18;this.holdRequested=1;return;}
   if(this.hero.x>=22){this.endingState=2;this.emit('music',19);this.marikoPose=27;this.resetHero();this.marikoStep=0;return;}
  }
  this.marikoPose=this.hero.running?32:36;
 }
 advancePlayer(input){if(this.endingState===2)return;super.advancePlayer(input);}
 leftWall(){const h=this.hero;if(h.running>=128)return;Object.assign(h,{legFrame:13,armFrame:13,legStep:1,armStep:1,legs:6,torso:6,x:7});}
 tick(input={}){
  this.events=[];if(this.phase!=='playing')return;this.clock++;
  let h=this.hero,e=this.enemy;const r=this.rules,c=this.camera,b=this.hawk;r.random=byte(5*r.random+13);
  if(c.room===5&&!this.entranceMusic){this.entranceMusic=true;this.emit('music',17);}
  if(this.endingState===2&&this.marikoStep===20){this.emit('wait',346);this.emit('music',20);this.phase='won';return;}
  if(h.legs===19&&b.delay&&(e.legs===19||e.legs===7||this.kind&&e.legs===6)){this.emit('music',22);this.phase='lost';return;}
  if(this.kind===5&&b.active&&b.delay)b.delay=byte(b.delay-1);
  if(!this.marker&&e.legs===19&&h.legs===6){this.marker=1;if(this.alive[0]){this.restoreDelay[0]=2;if(this.max[0]>=3){this.max[0]--;this.max[1]++;if(this.health[0]>this.max[0])this.health[0]=this.max[0];}if(this.kind===1){this.kind=2;this.emit('music',18);this.palette=2;this.marikoWait=0;}else this.deathDelay=1;}}
  this.advancePlayer(input);if(c.room===1&&h.x<6)this.leftWall();if(c.room===6)this.mariko();h=this.hero;
  this.context();if(this.kind<5){if(this.alive[0]&&this.threat){e.repeat=0;this.recovery=1;r.command(e,197);}else{r.ai(e);this.recovery=0;}r.advance(e);}
  this.context();this.results=[0,0];if(this.alive[0]&&this.kind<5){let result=r.contact(e.legs,h.contact,r.distance,false);if(result===255){if(c.room===4)this.activateHawk();result=3;}if(this.kind<2){this.results[1]=result;this.context();this.results[0]=r.contact(h.legs,e.contact,r.distance,true);}}
  if(h.x>=31&&this.door){this.results[0]=136;this.emit('bump',13);}if(this.endingState===254)this.results[0]=255;
  if(c.room===6&&e.x>=16)this.recovery=1;this.damage();this.heal();
  if(!this.alive[0]){b.turn=1;if(c.room===1&&h.x<9)h.x=9;}
  this.cameraTick();this.endFrame();
 }
}
root.KaratekaStage4=Stage4;
})(globalThis);
