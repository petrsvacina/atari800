/* Native palace loop, original bank-2 $B81A-$BC3A. Gate and bird keep their
 * separate original routines; the renderer redraws instead of repairing RAM. */
(function(root){'use strict';
const {byte}=root.KaratekaMotion;
class Stage2 extends root.KaratekaStage1{
 constructor(seed=7){super(seed);this.initPalace(seed);}
 initPalace(seed){
  this.hero.x=10;this.enemy.x=49;this.camera=new root.KaratekaCamera(2);this.max=[12,16];this.health=[12,16];this.restore=[0,0];this.restoreDelay=[30,30];this.alive=[1,1];this.rules.random=byte(seed);this.rules.data={...root.KARATEKA_MOTION_DATA,aiThresholds:root.KARATEKA_CAMPAIGN.scenes[2].aiThresholds};
  this.gate=new root.KaratekaHazards.Gate();this.hawk=new root.KaratekaHazards.PalaceHawk();this.hawk.active=7;this.guardStyle=1;this.progress=2;this.climb=0;this.mode='palace-intro';this.palette=3;this.courtSeen=0;this.birdEnabled=0;this.flash=0;this.resumeBody=false;this.enemyProbabilities();
 }
 enemyProbabilities(){if(this.camera?.scene!==2)return super.enemyProbabilities();const d=root.KARATEKA_CAMPAIGN.scenes[2],i=this.guardStyle;Object.assign(this.rules,{kickChance:d.kick[i],punchChance:d.punch[i],waitChance:d.wait[i]});}
 continueMovie(){if(this.mode==='palace-intro')this.mode='playing';else if(this.mode==='court'){this.mode='playing';this.courtSeen=1;this.hero.torso=6;this.rules.kick=this.rules.punch=0;this.resumeBody=true;}}
 beginEntrance(){
  const c=this.camera;this.saved={shift:c.shift,cloud:c.cloud,offset:c.offset,animated:!c.offset||c.offset>=85};this.newEnemy();this.marker=0;this.progress=1;this.enemy.x=byte(c.offset+19);
  if(!this.saved.animated)return this.endEntrance();
  Object.assign(this.enemy,{legs:35,torso:30,legFrame:67,armFrame:46,legStep:1,armStep:1,move:1});c.cloud=29;c.offset=28;c.shift=0;this.enemy.x=39;this.mode='entrance';
 }
 endEntrance(){
  const s=this.saved,c=this.camera;c.offset=s.offset;c.cloud=s.cloud;c.shift=s.shift;this.newEnemy();const x=byte(c.offset+19);this.enemy.x=byte(x-(s.animated?44:0));this.mode='playing';this.alive[1]=1;this.enemyWait=25;this.rules.kick=this.rules.punch=0;this.hawk.resetDelay({random:this.rules.random,flash:this.flash},s.animated&&x>=44?1:0);
 }
 beginApproach(){const delay=this.approachDelay;super.beginApproach();this.approachDelay=delay;this.enemyWait=14;}
 entranceTick(){const previous=this.mode;super.entranceTick();if(previous==='approach'&&this.mode==='playing')this.hawk.delay=this.hawk.nextDelay+4;}
 advancePlayer(input){
  const h=this.hero,r=this.rules;this.context();let idle=false;
  if(!this.alive[1]){if(!this.deathDelay&&this.enemy.legs===19){if(h.torso===28||h.torso===29){h.torso=6;r.kick=r.punch=0;}}else{h.move=0;r.command(h,209);idle=true;}}
  if(!idle){if(h.x>=34){h.move=1;r.command(h,0);}else this.poll(input);}
  r.advance(h);if(this.gate.y>=130&&!this.alive[0])r.advance(h);
  if(h.legFrame===21&&this.alive[1]&&!this.holdRequested){this.hold=30;this.holdRequested=1;}
 }
 leftWall(){const h=this.hero;if(h.running>=128)return;Object.assign(h,{legFrame:13,armFrame:13,legStep:1,armStep:1,legs:6,torso:6,x:5});}
 cameraTick(){
  const c=this.camera,h=this.hero;Object.assign(c,{heroX:h.x,enemyX:this.enemy.x,hawkX:this.hawk.x});
  if(h.x>=42)this.emit('scene',3);
  else if((c.offset===28&&!c.shift&&h.x>=15)||(!c.offset&&!c.shift&&h.x<15)||h.x===15)c.velocity=0;
  else if(h.x<15)c.left();else c.right(h.running,h.legFrame);
  h.x=c.heroX;this.enemy.x=c.enemyX;this.hawk.x=c.hawkX;
 }
 hazardContext(){return {hero:this.hero,motion:this.rules,activePose:this.hero.legs,heroAlive:this.alive[0],enemyAlive:this.alive[1],health:this.health[0],restore:this.restore[0],restoreDelay:this.restoreDelay[0],enemyImpact:this.hit[1],heroImpact:this.results[0],cue:0,flash:this.flash,hold:this.hold,holdRequested:this.holdRequested,random:this.rules.random,recovery:this.enemyWait,redraw:0,shift:this.camera.shift,enemyX:this.enemy.x};}
 acceptHazards(g){this.alive[0]=g.heroAlive;this.health[0]=g.health;this.restore[0]=g.restore;this.restoreDelay[0]=g.restoreDelay;this.hit[1]=g.enemyImpact;this.results[0]=g.heroImpact;this.flash=g.flash;this.hold=g.hold;this.holdRequested=g.holdRequested;this.enemyWait=g.recovery;if(g.cue)this.emit('gate',7);}
 tick(input={}){
  this.renderState=null;this.events=[];if(this.phase!=='playing'||this.mode==='court'||this.mode==='palace-intro')return;this.clock++;
  if(this.mode==='entrance'||this.mode==='approach'){this.entranceTick();this.endFrame();return;}
  const h=this.hero,e=this.enemy,r=this.rules,c=this.camera,b=this.hawk;
  if(!this.resumeBody){
   r.random=byte(5*r.random+13);
   if(h.legs===19&&this.gate.y===116&&b.delay&&(e.legs===19||e.legs===7)){this.emit('music',22);this.phase='lost';return;}
   let timers=true;
   if(this.alive[0]&&c.offset!==28){
    if(this.marker){if(!this.courtSeen){this.mode='court';this.emit('movie','court-palace');return;}if(this.marker===20){if(this.guardStyle<5)this.guardStyle++;this.enemyProbabilities();this.health[1]=this.max[1];this.emit('music',25);this.beginEntrance();if(this.mode==='entrance')this.entranceTick();this.endFrame();return;}this.marker=byte(this.marker+1);timers=false;}
    else if(!this.enemyWait&&b.delay>b.nextDelay&&this.alive[1]){this.beginApproach();this.entranceTick();this.endFrame();return;}
    if(timers&&b.active&&b.delay&&(this.guardStyle!==1||this.birdEnabled)){
     b.delay=byte(b.delay-1);if(!b.delay)b.spawn(this.hazardContext());
     else if(b.delay===b.nextDelay){if(byte(e.x-h.x)>=40)this.emit('music',25);else b.delay=byte(b.delay+1);}
    }
   }
  }else this.resumeBody=false;
  if(e.legs===19&&h.legs===6&&!this.marker&&this.alive[0]){this.deathDelay=this.marker=1;this.restoreDelay[0]=2;if(this.max[0]>=9){this.max[0]--;this.max[1]++;if(this.health[0]>this.max[0])this.health[0]=this.max[0];}}
  this.advancePlayer(input);if(h.x<4)this.leftWall();const temporaryPose=h.legs;
  if(h.legs===41){h.legs=255;h.x=byte(h.x-1);}
  const gh=this.hazardContext();gh.activePose=temporaryPose;this.gate.tick(gh);this.acceptHazards(gh);if(h.legs===255){h.x=byte(h.x+1);h.legs=41;}
  if(byte(e.x-h.x)>=60&&byte(48-c.offset+e.x)>=80){if(h.move===1)this.farDelay=15;else{this.farDelay=byte(this.farDelay-1);if(!this.farDelay)this.enemyWait=1;}this.enemyWait=byte(this.enemyWait-1);}
  this.context();if(this.buffer===32||e.legFrame>=14||!e.legStep){this.playerSide=this.enemySide=0;if(this.gate.y>=120&&e.x>=22)e.move=0;else r.ai(e);r.advance(e);}
  this.context();this.results=[0,0];if(this.alive[0]&&this.alive[1]){this.results[1]=r.contact(e.legs,h.contact,r.distance,false);this.context();if(this.buffer===32)this.results[0]=r.contact(h.legs,e.contact,r.distance,true);}
  const bh=this.hazardContext();b.tick(bh);this.acceptHazards(bh);
  if(h.x>=30&&h.x<33&&(!this.gate.velocity||this.gate.velocity>=128)&&this.gate.y>=124)this.results[0]=136;
  this.damage();this.heal();if(!this.alive[0])b.turn=1;this.cameraTick();
  if(!this.alive[0]){if(h.x<7)h.x=7;if(h.x===33&&!this.restore[0]&&this.health[0]){this.health[0]--;this.restoreDelay[0]=byte(this.restoreDelay[0]+10);}}
  b.animate({hero:h,distant:0});this.endFrame();
 }
}
root.KaratekaStage2=Stage2;
})(globalThis);
